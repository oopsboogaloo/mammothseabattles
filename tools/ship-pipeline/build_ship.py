"""Build web-ready ship miniatures (GLB) from the designer's Blender pirate ship.

Usage (Blender 4.2+ / 5.x, background mode):

    blender -b "<...>/Mammoth Sea Battles/pirateShipModel13-newedits.blend" \
            -P build_ship.py -- <out_dir>

Writes <out_dir>/ship.glb (~9k tris) and <out_dir>/ship-lod.glb (~2.5k tris).

The source .blend is only READ: nothing is ever saved back to it.

What it does
------------
The source has one connected mesh object, "Ship" (hull, mast, crow's nest,
two sails, flag, wheel and a bow cannon all welded together), plus hidden
mammoth/hat objects that are boolean-unioned onto the ship for 3D printing.
This script:

1. Drops everything except "Ship" and removes its boolean (mammoth) modifiers.
2. Splits the cage mesh into patches bounded by the designer's sharp edges and
   classifies each patch (sail port/starboard, flag, mast/rigging, cannon,
   hull) from its bounding box; hull faces facing up become "deck".
3. Applies Subdivision Surface (level 1 for the main model, 0 for the LOD),
   separates the parts into objects, closes the small holes left where parts
   were welded together, decimates to the triangle budget and sets
   smooth-by-angle shading.
4. Normalises: hull length (bow-stern, Blender Y) = 1.0, hull centred in X/Y,
   bottom of the hull at height 0. Blender +Y (bow) exports to glTF -Z.
5. Exports plain glTF binary (no Draco, no textures, no cameras/lights).

Objects:  hull (materials hull+deck), mast (mast), cannon (metal),
          flag (sail), sail_port (sail), sail_starboard (sail).
The sail objects have their origin at the top-centre of the sail (under the
yard), so scaling them in Y (glTF up) reefs the sail upwards.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

SOURCE_OBJECT = "Ship"

# (label, subsurf level, triangle target, filename)
BUILDS = [
    ("full", 1, 9000, "ship.glb"),
    ("lod", 0, 2500, "ship-lod.glb"),
]

# glTF material name -> (base colour, linear RGB), metallic, roughness
MATERIALS = {
    "hull": ((0.20, 0.090, 0.035), 0.0, 0.85),   # warm wood brown
    "deck": ((0.42, 0.27, 0.13), 0.0, 0.85),     # lighter wood
    "mast": ((0.075, 0.042, 0.022), 0.0, 0.85),  # dark wood
    "sail": ((0.82, 0.79, 0.70), 0.0, 0.95),     # off-white cloth
    "metal": ((0.045, 0.045, 0.05), 0.8, 0.45),  # dark iron
}

# Face labels used during classification (index = material slot on the cage).
LABELS = ["hull", "deck", "mast", "metal", "sail_port", "sail_starboard", "flag"]
L = {name: i for i, name in enumerate(LABELS)}
DECK_ELLIPSE = 0.8  # normalised radius² (hull half-beam 3.2, half-length 4.4)

# Output objects: name -> (labels it contains, material per label)
OBJECTS = {
    "hull": ["hull", "deck"],
    "mast": ["mast"],
    "cannon": ["metal"],
    "flag": ["flag"],
    "sail_port": ["sail_port"],
    "sail_starboard": ["sail_starboard"],
}
LABEL_MATERIAL = {
    "hull": "hull", "deck": "deck", "mast": "mast", "metal": "metal",
    "sail_port": "sail", "sail_starboard": "sail", "flag": "sail",
}


def out_dir_from_argv():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not argv:
        raise SystemExit("usage: blender -b src.blend -P build_ship.py -- <out_dir>")
    return os.path.abspath(argv[0])


# --------------------------------------------------------------------------
# Classification (on the unsubdivided cage, coordinates in the object's local
# space of pirateShipModel13: bow = +Y, up = +Z, keel bottom z = -0.42).
# --------------------------------------------------------------------------

def sharp_patches(bm):
    """Groups of faces connected across smooth (non-sharp) manifold edges."""
    seen = {}
    patches = []
    for f in bm.faces:
        if f.index in seen:
            continue
        k = len(patches)
        seen[f.index] = k
        reg = [f]
        stack = [f]
        while stack:
            x = stack.pop()
            for e in x.edges:
                if not e.smooth or len(e.link_faces) != 2:
                    continue
                for g in e.link_faces:
                    if g.index not in seen:
                        seen[g.index] = k
                        reg.append(g)
                        stack.append(g)
        patches.append(reg)
    return patches


def bbox(faces):
    vs = {v for f in faces for v in f.verts}
    return [(min(v.co[i] for v in vs), max(v.co[i] for v in vs)) for i in range(3)]


def classify(bm):
    counts = {}
    for reg in sharp_patches(bm):
        (x0, x1), (y0, y1), (z0, z1) = bbox(reg)
        if (z0 > 2.3 and z1 < 6.6 and (x0 > 0.6 or x1 < -0.6)
                and max(abs(x0), abs(x1)) > 1.0 and y0 > -1.6 and y1 < 2.3):
            label = "sail_starboard" if (x0 + x1) > 0 else "sail_port"
            for f in reg:
                f.material_index = L[label]
        elif z0 > 7.4 and (x1 - x0) < 0.6 and (y1 - y0) > 1.5:
            # flagpole + flag: the cloth streams aft (-Y) of the pole
            for f in reg:
                c = f.calc_center_median()
                f.material_index = L["flag"] if (c.y < -0.2 and c.z > 8.4) else L["mast"]
        elif y0 > 2.3 and z0 > 1.8 and (x1 - x0) < 1.6:
            for f in reg:
                f.material_index = L["metal"]   # bow cannon
        elif z1 > 3.4:
            for f in reg:
                f.material_index = L["mast"]    # mast, yards, crow's nest, wheel
        else:
            # Hull. Up-facing faces well inside the hull outline are deck; the
            # up-facing steps of the outer planking stay hull-coloured.
            for f in reg:
                c = f.calc_center_median()
                inside = (c.x / 3.2) ** 2 + ((c.y - 0.19) / 4.4) ** 2 < DECK_ELLIPSE
                up = f.normal.z > 0.7 and c.z > 0.0 and inside
                f.material_index = L["deck"] if up else L["hull"]
    for f in bm.faces:
        counts[LABELS[f.material_index]] = counts.get(LABELS[f.material_index], 0) + 1
    return counts


# --------------------------------------------------------------------------

def make_materials():
    mats = {}
    for name, (rgb, metal, rough) in MATERIALS.items():
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rough
        m.diffuse_color = (*rgb, 1.0)
        m.roughness = rough
        m.metallic = metal
        mats[name] = m
    return mats


def evaluated_copy(obj, name):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    me.name = name
    return me


def tri_count(me):
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def build(src, label, level, target, mats, out_path):
    coll = bpy.data.collections.new("export_" + label)
    bpy.context.scene.collection.children.link(coll)

    # Cage copy with labels as material slots, world transform baked in.
    # (Set the material slots BEFORE writing indices: Mesh.materials.clear()
    # drops the material_index attribute.)
    cage = src.data.copy()
    cage.materials.clear()
    for lab in LABELS:
        cage.materials.append(mats[LABEL_MATERIAL[lab]])
    bm = bmesh.new()
    bm.from_mesh(cage)
    counts = classify(bm)
    bm.to_mesh(cage)
    bm.free()
    work = bpy.data.objects.new("work_" + label, cage)
    coll.objects.link(work)
    if level > 0:
        sub = work.modifiers.new("Subsurf", "SUBSURF")
        sub.levels = level
        sub.render_levels = level
    me_all = evaluated_copy(work, "all_" + label)
    me_all.transform(src.matrix_world)
    print(f"[{label}] cage face labels: {counts}; subdivided tris: {tri_count(me_all)}")

    total = tri_count(me_all)
    ratio = min(1.0, target / total)

    parts = {}
    for oname, labs in OBJECTS.items():
        keep = {L[l] for l in labs}
        bm = bmesh.new()
        bm.from_mesh(me_all)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in keep],
                         context="FACES")
        if not bm.faces:
            bm.free()
            print(f"[{label}] WARNING: no faces for {oname}")
            continue
        # close the openings left where this part was welded to another one
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        me = bpy.data.meshes.new(oname + "_tmp")
        bm.to_mesh(me)
        bm.free()
        for i, lab in enumerate(LABELS):
            me.materials.append(mats[LABEL_MATERIAL[lab]])
        ob = bpy.data.objects.new(oname + "_tmp", me)
        coll.objects.link(ob)
        if ratio < 1.0:
            dec = ob.modifiers.new("Decimate", "DECIMATE")
            dec.decimate_type = "COLLAPSE"
            dec.ratio = ratio
            dec.use_collapse_triangulate = True
        me2 = evaluated_copy(ob, oname)
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
        # Drop unused material slots, keep only this object's materials in order.
        used = []
        for p in me2.polygons:
            if p.material_index not in used:
                used.append(p.material_index)
        used.sort()
        remap = {old: new for new, old in enumerate(used)}
        idx = [remap[p.material_index] for p in me2.polygons]
        slot_mats = [me2.materials[i] for i in used]
        me2.materials.clear()
        for m in slot_mats:
            me2.materials.append(m)
        me2.polygons.foreach_set("material_index", idx)
        me2.shade_smooth()
        me2.set_sharp_from_angle(angle=math.radians(40))
        ob2 = bpy.data.objects.new(oname, me2)
        coll.objects.link(ob2)
        parts[oname] = ob2
    bpy.data.objects.remove(work)
    bpy.data.meshes.remove(cage)
    bpy.data.meshes.remove(me_all)

    # Normalise: hull length 1.0 along Y, hull centred in X/Y, hull bottom z=0.
    hull = parts["hull"]
    vs = [v.co for v in hull.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    s = 1.0 / (hi.y - lo.y)
    t = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    norm = Matrix.Scale(s, 4) @ Matrix.Translation(t)
    for ob in parts.values():
        ob.data.transform(norm)
    # Sail origins at top-centre so client can scale them to reef.
    for oname, ob in parts.items():
        if oname.startswith("sail_"):
            vs = [v.co for v in ob.data.vertices]
            p = Vector(((min(v.x for v in vs) + max(v.x for v in vs)) / 2,
                        (min(v.y for v in vs) + max(v.y for v in vs)) / 2,
                        max(v.z for v in vs)))
            ob.data.transform(Matrix.Translation(-p))
            ob.location = p

    report = {n: tri_count(o.data) for n, o in parts.items()}
    print(f"[{label}] hull scale {s:.6f}; tris per object {report}; total {sum(report.values())}")

    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob in parts.values():
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts["hull"]
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_draco_mesh_compression_enable=False,
    )
    print(f"[{label}] wrote {out_path} ({os.path.getsize(out_path)} bytes)")

    for ob in list(coll.objects):
        me = ob.data
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
    bpy.data.collections.remove(coll)


def main():
    out_dir = out_dir_from_argv()
    src = bpy.data.objects.get(SOURCE_OBJECT)
    if src is None or src.type != "MESH":
        raise SystemExit(f"no mesh object named {SOURCE_OBJECT!r} in {bpy.data.filepath}")
    # Leave only the ship in the scene (in memory only; the file is never saved).
    for ob in list(bpy.context.scene.objects):
        if ob is not src:
            bpy.data.objects.remove(ob)
    for md in list(src.modifiers):
        src.modifiers.remove(md)
    src.hide_set(True)
    src.hide_render = True
    mats = make_materials()
    for label, level, target, fname in BUILDS:
        build(src, label, level, target, mats, os.path.join(out_dir, fname))
    # Remove the source object too so nothing else could ever be exported.
    bpy.data.objects.remove(src)


if __name__ == "__main__":
    main()
