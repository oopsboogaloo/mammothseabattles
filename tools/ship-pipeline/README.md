# Ship pipeline

Builds the web ship miniatures in `packages/client/public/models/` from the
designer's Blender model.

**Source:** `OneDrive\Documents\creative\Boardgames\Mammoth Sea Battles\pirateShipModel13-newedits.blend`
(object `Ship`; the newest file, Feb 2025). The script only reads it and never saves.

## Run

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b ^
  "%USERPROFILE%\OneDrive\Documents\creative\Boardgames\Mammoth Sea Battles\pirateShipModel13-newedits.blend" ^
  -P tools\ship-pipeline\build_ship.py -- packages\client\public\models
```

Takes about 10 seconds. It writes:

| file           | triangles | size    | built from                         |
|----------------|-----------|---------|------------------------------------|
| `ship.glb`     | ~9.2k     | ~215 KB | subdivision level 1, then decimated |
| `ship-lod.glb` | ~2.6k     | ~85 KB  | the raw cage, decimated             |

Plain glTF binary: no Draco, no textures, no cameras or lights.

## What the client can rely on

- Y-up. The bow points along **-Z**. Starboard is **+X**.
- The hull is exactly **1.0** long in Z (from -0.5 to 0.5) and centred in X and Z.
  The **bottom of the hull is at y = 0**. The model has a flat base and no waterline is
  marked. The model is about 1.16 tall at the flag and about 0.94 wide across the yards.
- Nodes: `hull` (materials `hull` + `deck`), `mast` (mast, yards, crow's nest,
  flagpole and wheel; material `mast`), `cannon` (`metal`), `flag` (`sail`),
  `sail_port` and `sail_starboard` (`sail`).
- The origin of each `sail_*` node is the top centre of the sail, under the yard. If you scale
  it in Y, the sail reefs upwards. The flag also uses the `sail` material, so it
  takes the player colour too, but it isn't a `sail_*` node.
- Materials have flat colours: roughness 0.85–0.95 and metallic 0, except `metal`.

## How the parts are found

In the source the whole ship is one welded mesh. The script splits it into
patches along the designer's sharp edges and classifies each patch by its
bounding box (see `classify()`). The classification thresholds are tuned to
this file, so check the printed face counts if you build from a different
source file. The mammoth/hat boolean unions, which were for 3D printing, are
dropped.
