"""Build the production Blue Rally RC model and export a Unity-ready FBX.

The body starts from IceMaan's CC0 A_R7_Body_3 mesh. This deterministic
pipeline converts it into a compact RC coupe, consolidates it to six solid
materials, separates Unity-facing parts, adds RC-specific details and exports
the final FBX, Blender source, triangle report, and preview render.

Run from the repository root:
    blender --background --python RC_Weekly_TimeAttack/Tools/Blender/generate_blue_rally_rc.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_BODY_PATH = (
    PROJECT_ROOT
    / "ArtSource"
    / "ThirdParty"
    / "IceMaan"
    / "A_R7"
    / "A_R7_Body_3.fbx"
)
SOURCE_DIR = PROJECT_ROOT / "ArtSource" / "Vehicles" / "BlueRallyRC"
FBX_DIR = PROJECT_ROOT / "Assets" / "_Project" / "Resources" / "Vehicles"
PREVIEW_DIR = PROJECT_ROOT / "docs" / "implementation"

BLEND_PATH = SOURCE_DIR / "BlueRallyRC.blend"
REPORT_PATH = SOURCE_DIR / "BlueRallyRC.model-report.json"
FBX_PATH = FBX_DIR / "BlueRallyRC.fbx"
PREVIEW_PATH = PREVIEW_DIR / "blue-rally-rc-blender-preview.png"

TARGET_TRIANGLE_MIN = 8_000
TARGET_TRIANGLE_MAX = 15_000


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data_collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(data_collection):
            if item.users == 0:
                data_collection.remove(item)


def create_material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.3,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader is not None:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Metallic"].default_value = metallic
        shader.inputs["Roughness"].default_value = roughness
    return material


def set_smooth(object_: bpy.types.Object) -> None:
    if object_.type != "MESH":
        return
    for polygon in object_.data.polygons:
        polygon.use_smooth = True


def apply_rotation_and_scale(object_: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = object_
    object_.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    object_.select_set(False)


def apply_modifier(object_: bpy.types.Object, modifier_name: str) -> None:
    bpy.context.view_layer.objects.active = object_
    object_.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier_name)
    object_.select_set(False)


def create_beveled_cube(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.02,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    object_ = bpy.context.object
    object_.name = name
    object_.dimensions = dimensions
    apply_rotation_and_scale(object_)
    modifier = object_.modifiers.new("ProductionBevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    modifier.limit_method = "ANGLE"
    apply_modifier(object_, modifier.name)
    object_.data.materials.append(material)
    set_smooth(object_)
    return object_


def create_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    major_segments: int = 26,
    minor_segments: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=(math.pi * 0.5, 0.0, 0.0),
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    object_ = bpy.context.object
    object_.name = name
    apply_rotation_and_scale(object_)
    object_.data.materials.append(material)
    set_smooth(object_)
    return object_


def create_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    vertices: int = 20,
    rotation: tuple[float, float, float] = (math.pi * 0.5, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    object_ = bpy.context.object
    object_.name = name
    apply_rotation_and_scale(object_)
    object_.data.materials.append(material)
    set_smooth(object_)
    return object_


def create_uv_sphere(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=14,
        ring_count=7,
        radius=radius,
        location=location,
    )
    object_ = bpy.context.object
    object_.name = name
    object_.data.materials.append(material)
    set_smooth(object_)
    return object_


def join_objects(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
    if not objects:
        raise ValueError(f"Cannot create {name} from an empty object list")
    if len(objects) == 1:
        objects[0].name = name
        objects[0].select_set(False)
        return objects[0]
    bpy.ops.object.select_all(action="DESELECT")
    for object_ in objects:
        object_.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.select_set(False)
    return result


def material_key(source_name: str) -> str:
    name = source_name.lower()
    if "rear" in name:
        return "tail"
    if "head" in name:
        return "lamp"
    if "glass" in name:
        return "glass"
    if "det" in name or "under" in name or "exhaust" in name:
        return "graphite"
    return "body"


def import_and_split_body(
    materials: dict[str, bpy.types.Material],
) -> tuple[bpy.types.Object, bpy.types.Object, bpy.types.Object, bpy.types.Object]:
    if not SOURCE_BODY_PATH.exists():
        raise FileNotFoundError(f"Missing CC0 body source: {SOURCE_BODY_PATH}")

    bpy.ops.import_scene.fbx(filepath=str(SOURCE_BODY_PATH), use_anim=False)
    imported_meshes = [
        object_ for object_ in bpy.context.scene.objects if object_.type == "MESH"
    ]
    if len(imported_meshes) != 1:
        raise RuntimeError(
            f"Expected one A_R7 body mesh, found {[item.name for item in imported_meshes]}"
        )

    body = imported_meshes[0]
    body.name = "A_R7_RC_Source"
    source_materials = [slot.material for slot in body.material_slots]
    ordered_keys = ["body", "graphite", "glass", "yellow", "lamp", "tail"]
    material_indices = {key: index for index, key in enumerate(ordered_keys)}
    target_indices = [
        material_indices[material_key(source_materials[polygon.material_index].name)]
        for polygon in body.data.polygons
    ]
    body.data.materials.clear()
    for key in ordered_keys:
        body.data.materials.append(materials[key])
    for polygon, material_index in zip(body.data.polygons, target_indices):
        polygon.material_index = material_index

    body.scale = (0.72, 1.07, 1.22)
    apply_rotation_and_scale(body)
    edge_softening = body.modifiers.new("BodyEdgeSoftening", "BEVEL")
    edge_softening.width = 0.018
    edge_softening.segments = 1
    edge_softening.limit_method = "ANGLE"
    apply_modifier(body, edge_softening.name)

    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    separated = [
        object_ for object_ in bpy.context.selected_objects if object_.type == "MESH"
    ]

    pieces: dict[str, list[bpy.types.Object]] = {}
    for object_ in separated:
        if not object_.data.polygons:
            continue
        polygon = object_.data.polygons[0]
        material = object_.data.materials[polygon.material_index]
        pieces.setdefault(material.name, []).append(object_)

    def require_piece(material_name: str, object_name: str) -> bpy.types.Object:
        source_pieces = pieces.get(material_name, [])
        if not source_pieces:
            raise RuntimeError(f"A_R7 body is missing {material_name} geometry")
        return join_objects(object_name, source_pieces)

    body_shell = require_piece("M_BlueBody", "BodyShell")
    canopy = require_piece("M_SmokedGlass", "Canopy")
    aero_kit = require_piece("M_Graphite", "AeroKit")
    light_parts = pieces.get("M_LampWhite", []) + pieces.get("M_TailRed", [])
    headlights = join_objects("Headlights", light_parts)
    return body_shell, canopy, aero_kit, headlights


def create_wheel(
    name: str,
    location: tuple[float, float, float],
    outward_sign: float,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    x, y, z = location
    outer_face_y = y + outward_sign * 0.09
    parts = [
        create_torus(
            f"{name}_Tire",
            location,
            0.305,
            0.115,
            materials["graphite"],
        ),
        create_torus(
            f"{name}_Rim",
            (x, outer_face_y, z),
            0.205,
            0.042,
            materials["graphite"],
            major_segments=22,
            minor_segments=7,
        ),
        create_cylinder(
            f"{name}_Hub",
            (x, outer_face_y + outward_sign * 0.015, z),
            0.072,
            0.05,
            materials["yellow"],
        ),
    ]
    for spoke_index in range(5):
        angle = math.tau * spoke_index / 5.0
        parts.append(
            create_beveled_cube(
                f"{name}_Spoke_{spoke_index + 1}",
                (
                    x + math.cos(angle) * 0.11,
                    outer_face_y,
                    z + math.sin(angle) * 0.11,
                ),
                (0.245, 0.050, 0.065),
                materials["graphite"],
                bevel=0.012,
                rotation=(0.0, -angle, 0.0),
            )
        )
    wheel = join_objects(name, parts)
    wheel["wheelRadius"] = 0.42
    wheel["steering"] = name.endswith("FL") or name.endswith("FR")
    return wheel


def rotate_to_unity_coordinates(objects: list[bpy.types.Object]) -> None:
    # Source vehicle forward is +X. Unity-facing Blender convention is -Y,
    # with vehicle width on X and height on Z.
    rotation = Matrix.Rotation(-math.pi * 0.5, 4, "Z")
    for object_ in objects:
        if object_.type == "MESH":
            object_.data.transform(rotation)
            object_.data.update()
        object_.location = rotation @ object_.location


def triangulate_meshes(objects: list[bpy.types.Object]) -> None:
    for object_ in objects:
        if object_.type != "MESH":
            continue
        modifier = object_.modifiers.new("ExportTriangulation", "TRIANGULATE")
        modifier.quad_method = "BEAUTY"
        modifier.ngon_method = "BEAUTY"
        apply_modifier(object_, modifier.name)


def create_model() -> tuple[
    bpy.types.Object,
    list[bpy.types.Object],
    dict[str, bpy.types.Material],
]:
    materials = {
        "body": create_material("M_BlueBody", (0.005, 0.055, 0.58, 1.0), 0.12, 0.22),
        "graphite": create_material("M_Graphite", (0.012, 0.018, 0.028, 1.0), 0.12, 0.34),
        "glass": create_material("M_SmokedGlass", (0.008, 0.014, 0.025, 1.0), 0.22, 0.16),
        "yellow": create_material("M_YellowAccent", (1.0, 0.57, 0.012, 1.0), 0.02, 0.28),
        "lamp": create_material("M_LampWhite", (0.90, 0.96, 1.0, 1.0), 0.0, 0.12),
        "tail": create_material("M_TailRed", (1.0, 0.02, 0.01, 1.0), 0.0, 0.18),
    }

    body, canopy, aero_kit, headlights = import_and_split_body(materials)
    wheels = [
        create_wheel("Wheel_FL", (0.86, -0.80, 0.22), -1.0, materials),
        create_wheel("Wheel_FR", (0.86, 0.80, 0.22), 1.0, materials),
        create_wheel("Wheel_RL", (-0.81, -0.80, 0.22), -1.0, materials),
        create_wheel("Wheel_RR", (-0.81, 0.80, 0.22), 1.0, materials),
    ]

    wing = join_objects(
        "RearWing",
        [
            create_beveled_cube("WingDeck", (-1.03, 0.0, 0.91), (0.22, 1.34, 0.09), materials["graphite"], 0.025),
            create_beveled_cube("WingPostLeft", (-0.95, -0.40, 0.70), (0.10, 0.09, 0.42), materials["graphite"], 0.015),
            create_beveled_cube("WingPostRight", (-0.95, 0.40, 0.70), (0.10, 0.09, 0.42), materials["graphite"], 0.015),
            create_beveled_cube("WingTipLeft", (-1.03, -0.69, 0.92), (0.25, 0.08, 0.18), materials["yellow"], 0.018),
            create_beveled_cube("WingTipRight", (-1.03, 0.69, 0.92), (0.25, 0.08, 0.18), materials["yellow"], 0.018),
        ],
    )

    details = join_objects(
        "RCDetails",
        [
            create_cylinder("HoodClipLeft", (0.88, -0.22, 0.72), 0.036, 0.045, materials["graphite"], rotation=(0.0, 0.0, 0.0)),
            create_cylinder("HoodClipRight", (0.88, 0.22, 0.72), 0.036, 0.045, materials["graphite"], rotation=(0.0, 0.0, 0.0)),
            create_cylinder("Antenna", (-0.20, 0.0, 1.06), 0.018, 0.28, materials["graphite"], 14, rotation=(0.0, 0.0, 0.0)),
            create_uv_sphere("AntennaTip", (-0.20, 0.0, 1.21), 0.042, materials["graphite"]),
            create_beveled_cube("SkirtAccentLeft", (0.0, -0.825, 0.14), (0.92, 0.035, 0.050), materials["yellow"], 0.012),
            create_beveled_cube("SkirtAccentRight", (0.0, 0.825, 0.14), (0.92, 0.035, 0.050), materials["yellow"], 0.012),
        ],
    )

    model_objects = [body, canopy, aero_kit, headlights, wing, details, *wheels]
    rotate_to_unity_coordinates(model_objects)
    triangulate_meshes(model_objects)

    root = bpy.data.objects.new("BlueRallyRC", None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.25
    bpy.context.collection.objects.link(root)
    for object_ in model_objects:
        object_.parent = root
        object_.select_set(False)
    return root, model_objects, materials


def setup_preview() -> None:
    bpy.ops.object.camera_add(location=(4.3, -5.2, 2.4))
    camera = bpy.context.object
    camera.name = "PreviewCamera"
    direction = Vector((0.0, 0.0, 0.43)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 58
    bpy.context.scene.camera = camera

    for name, location, energy, size in (
        ("PreviewKey", (-3.0, -4.0, 6.0), 950.0, 5.0),
        ("PreviewFill", (4.0, 2.0, 3.0), 550.0, 4.0),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.size = size

    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.20))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground.data.materials.append(
        create_material("M_PreviewGround", (0.55, 0.57, 0.61, 1.0), 0.0, 0.70)
    )

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.65, 0.67, 0.72)
    bpy.ops.render.render(write_still=True)


def export_model(root: bpy.types.Object, model_objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for object_ in model_objects:
        object_.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.fbx(
        filepath=str(FBX_PATH),
        use_selection=True,
        object_types={"EMPTY", "MESH"},
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        use_space_transform=True,
        bake_space_transform=False,
        axis_forward="-Z",
        axis_up="Y",
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_tspace=False,
        add_leaf_bones=False,
        bake_anim=False,
        path_mode="AUTO",
        embed_textures=False,
    )


def write_report(
    model_objects: list[bpy.types.Object],
    materials: dict[str, bpy.types.Material],
) -> None:
    object_triangles = {
        object_.name: len(object_.data.polygons)
        for object_ in model_objects
        if object_.type == "MESH"
    }
    total_triangles = sum(object_triangles.values())
    report = {
        "model": "BlueRallyRC",
        "triangleDefinition": "All exported mesh polygons are triangulated",
        "targetTriangleRange": [TARGET_TRIANGLE_MIN, TARGET_TRIANGLE_MAX],
        "totalTriangles": total_triangles,
        "withinTarget": TARGET_TRIANGLE_MIN <= total_triangles <= TARGET_TRIANGLE_MAX,
        "meshObjects": object_triangles,
        "materials": sorted(material.name for material in materials.values()),
        "fbx": str(FBX_PATH.relative_to(PROJECT_ROOT)),
        "sourceBlend": str(BLEND_PATH.relative_to(PROJECT_ROOT)),
        "baseMesh": str(SOURCE_BODY_PATH.relative_to(PROJECT_ROOT)),
        "baseMeshLicense": "CC0",
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if not report["withinTarget"]:
        raise RuntimeError(
            f"BlueRallyRC has {total_triangles} triangles; expected "
            f"{TARGET_TRIANGLE_MIN}..{TARGET_TRIANGLE_MAX}"
        )
    print(json.dumps(report, indent=2))


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    FBX_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    reset_scene()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    root, model_objects, materials = create_model()
    write_report(model_objects, materials)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    export_model(root, model_objects)
    setup_preview()


if __name__ == "__main__":
    main()
