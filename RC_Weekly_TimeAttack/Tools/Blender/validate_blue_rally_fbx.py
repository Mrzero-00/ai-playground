"""Re-import the exported FBX and validate the Unity-facing model contract."""

from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FBX_PATH = PROJECT_ROOT / "Assets" / "_Project" / "Resources" / "Vehicles" / "BlueRallyRC.fbx"
EXPECTED_MESHES = {
    "BodyShell",
    "Canopy",
    "AeroKit",
    "Headlights",
    "RearWing",
    "RCDetails",
    "Wheel_FL",
    "Wheel_FR",
    "Wheel_RL",
    "Wheel_RR",
}
EXPECTED_MATERIALS = {
    "M_BlueBody",
    "M_Graphite",
    "M_LampWhite",
    "M_SmokedGlass",
    "M_TailRed",
    "M_YellowAccent",
}


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=str(FBX_PATH), use_anim=False)

    meshes = {object_.name: object_ for object_ in bpy.context.scene.objects if object_.type == "MESH"}
    missing_meshes = EXPECTED_MESHES - meshes.keys()
    if missing_meshes:
        raise RuntimeError(f"FBX is missing meshes: {sorted(missing_meshes)}")

    total_triangles = sum(len(meshes[name].data.polygons) for name in EXPECTED_MESHES)
    if not 8_000 <= total_triangles <= 15_000:
        raise RuntimeError(f"Unexpected imported triangle count: {total_triangles}")

    material_names = {
        material.name
        for name in EXPECTED_MESHES
        for material in meshes[name].data.materials
        if material is not None
    }
    missing_materials = EXPECTED_MATERIALS - material_names
    if missing_materials:
        raise RuntimeError(f"FBX is missing materials: {sorted(missing_materials)}")

    world_vertices = [
        object_.matrix_world @ vertex.co
        for name in EXPECTED_MESHES
        for object_ in [meshes[name]]
        for vertex in object_.data.vertices
    ]
    minimum = tuple(min(vertex[axis] for vertex in world_vertices) for axis in range(3))
    maximum = tuple(max(vertex[axis] for vertex in world_vertices) for axis in range(3))
    dimensions = tuple(maximum[axis] - minimum[axis] for axis in range(3))
    if dimensions[1] <= dimensions[0]:
        raise RuntimeError(f"Expected vehicle length on Blender Y axis; got dimensions {dimensions}")

    print(
        {
            "fbx": str(FBX_PATH),
            "totalTriangles": total_triangles,
            "meshCount": len(EXPECTED_MESHES),
            "materialCount": len(material_names),
            "dimensionsXYZ": dimensions,
            "wheelObjects": [name for name in sorted(EXPECTED_MESHES) if name.startswith("Wheel_")],
        }
    )


if __name__ == "__main__":
    main()
