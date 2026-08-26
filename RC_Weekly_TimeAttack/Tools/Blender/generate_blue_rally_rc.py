"""Generate the production-feasible Blue Rally RC model and export it to Unity FBX.

Run from the repository root:
    blender --background --python RC_Weekly_TimeAttack/Tools/Blender/generate_blue_rally_rc.py

The script is intentionally deterministic so the FBX, source .blend, preview, and
triangle report can be regenerated without manual Blender scene edits.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
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
    roughness: float = 0.42,
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
    bevel: float = 0.035,
    bevel_segments: int = 2,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    object_ = bpy.context.object
    object_.name = name
    object_.dimensions = dimensions
    apply_rotation_and_scale(object_)
    if bevel > 0.0:
        modifier = object_.modifiers.new("ProductionBevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = bevel_segments
        modifier.limit_method = "ANGLE"
        apply_modifier(object_, modifier.name)
    object_.data.materials.append(material)
    set_smooth(object_)
    return object_


def create_uv_ellipsoid(
    name: str,
    location: tuple[float, float, float],
    radii: tuple[float, float, float],
    material: bpy.types.Material,
    segments: int = 24,
    ring_count: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=ring_count,
        location=location,
    )
    object_ = bpy.context.object
    object_.name = name
    object_.scale = radii
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
    vertices: int = 24,
    rotation: tuple[float, float, float] = (0.0, math.pi * 0.5, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        end_fill_type="NGON",
        location=location,
        rotation=rotation,
    )
    object_ = bpy.context.object
    object_.name = name
    apply_rotation_and_scale(object_)
    object_.data.materials.append(material)
    set_smooth(object_)
    return object_


def create_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        align="WORLD",
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=(0.0, math.pi * 0.5, 0.0),
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    object_ = bpy.context.object
    object_.name = name
    apply_rotation_and_scale(object_)
    object_.data.materials.append(material)
    set_smooth(object_)
    return object_


def join_objects(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
    if not objects:
        raise ValueError(f"Cannot create {name} from an empty object list")
    bpy.ops.object.select_all(action="DESELECT")
    for object_ in objects:
        object_.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.select_set(False)
    return result


def interpolate_profile(
    controls: list[tuple[float, float, float, float]],
    y: float,
) -> tuple[float, float, float]:
    for index in range(len(controls) - 1):
        left = controls[index]
        right = controls[index + 1]
        if left[0] <= y <= right[0]:
            amount = (y - left[0]) / max(0.0001, right[0] - left[0])
            smooth = amount * amount * (3.0 - 2.0 * amount)
            return tuple(
                left[value_index] + (right[value_index] - left[value_index]) * smooth
                for value_index in range(1, 4)
            )
    return controls[-1][1], controls[-1][2], controls[-1][3]


def create_body_shell(material: bpy.types.Material) -> bpy.types.Object:
    # Blender forward is -Y. The profile stays inside the existing physics box.
    controls = [
        (-1.24, 0.32, 0.30, 0.18),
        (-1.08, 0.63, 0.32, 0.23),
        (-0.76, 0.78, 0.34, 0.27),
        (-0.28, 0.76, 0.35, 0.28),
        (0.30, 0.72, 0.35, 0.27),
        (0.72, 0.79, 0.34, 0.27),
        (1.03, 0.66, 0.31, 0.23),
        (1.18, 0.35, 0.28, 0.17),
    ]
    longitudinal_segments = 20
    ring_segments = 28
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []

    for station in range(longitudinal_segments):
        amount = station / (longitudinal_segments - 1)
        y = controls[0][0] + (controls[-1][0] - controls[0][0]) * amount
        half_width, center_z, half_height = interpolate_profile(controls, y)
        for ring_index in range(ring_segments):
            angle = math.tau * ring_index / ring_segments
            cosine = math.cos(angle)
            sine = math.sin(angle)
            shaped_sine = (
                math.pow(sine, 0.82)
                if sine >= 0.0
                else -math.pow(-sine, 1.22)
            )
            vertices.append(
                (cosine * half_width, y, center_z + shaped_sine * half_height)
            )

    for station in range(longitudinal_segments - 1):
        first_ring = station * ring_segments
        next_ring = (station + 1) * ring_segments
        for ring_index in range(ring_segments):
            next_index = (ring_index + 1) % ring_segments
            faces.append(
                (
                    first_ring + ring_index,
                    next_ring + ring_index,
                    next_ring + next_index,
                    first_ring + next_index,
                )
            )

    front_center_index = len(vertices)
    vertices.append((0.0, controls[0][0], controls[0][2]))
    rear_center_index = len(vertices)
    vertices.append((0.0, controls[-1][0], controls[-1][2]))
    for ring_index in range(ring_segments):
        next_index = (ring_index + 1) % ring_segments
        faces.append((front_center_index, next_index, ring_index))
        rear_ring = (longitudinal_segments - 1) * ring_segments
        faces.append((rear_center_index, rear_ring + ring_index, rear_ring + next_index))

    mesh = bpy.data.meshes.new("BlueRallyBodyShellMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    object_ = bpy.data.objects.new("BodyShell", mesh)
    bpy.context.collection.objects.link(object_)
    object_.data.materials.append(material)
    set_smooth(object_)

    subdivision = object_.modifiers.new("BodySurface", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1
    apply_modifier(object_, subdivision.name)
    return object_


def create_wheel(
    name: str,
    location: tuple[float, float, float],
    outward_sign: float,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    x, y, z = location
    outer_face_x = x + outward_sign * 0.17
    parts = [
        create_cylinder(f"{name}_Tire", location, 0.39, 0.34, materials["graphite"], vertices=32),
        create_torus(f"{name}_Rim", (outer_face_x, y, z), 0.215, 0.045, materials["metal"]),
        create_cylinder(
            f"{name}_Hub",
            (outer_face_x + outward_sign * 0.015, y, z),
            0.075,
            0.055,
            materials["yellow"],
            vertices=20,
        ),
    ]
    for spoke_index in range(5):
        angle = math.tau * spoke_index / 5.0
        radial_y = math.sin(angle)
        radial_z = math.cos(angle)
        spoke = create_beveled_cube(
            f"{name}_Spoke_{spoke_index + 1}",
            (
                outer_face_x,
                y + radial_y * 0.11,
                z + radial_z * 0.11,
            ),
            (0.045, 0.060, 0.235),
            materials["metal"],
            bevel=0.012,
            bevel_segments=1,
            rotation=(angle, 0.0, 0.0),
        )
        parts.append(spoke)
    wheel = join_objects(name, parts)
    wheel["wheelRadius"] = 0.39
    wheel["steering"] = name.endswith("FL") or name.endswith("FR")
    return wheel


def parent_to_root(root: bpy.types.Object, objects: list[bpy.types.Object]) -> None:
    for object_ in objects:
        object_.parent = root


def triangulate_meshes(objects: list[bpy.types.Object]) -> None:
    for object_ in objects:
        if object_.type != "MESH":
            continue
        modifier = object_.modifiers.new("ExportTriangulation", "TRIANGULATE")
        modifier.quad_method = "BEAUTY"
        modifier.ngon_method = "BEAUTY"
        apply_modifier(object_, modifier.name)


def create_model() -> tuple[bpy.types.Object, list[bpy.types.Object], dict[str, bpy.types.Material]]:
    materials = {
        "body": create_material("M_BlueBody", (0.012, 0.16, 0.88, 1.0), metallic=0.10, roughness=0.27),
        "graphite": create_material("M_Graphite", (0.018, 0.025, 0.040, 1.0), metallic=0.05, roughness=0.48),
        "glass": create_material("M_SmokedGlass", (0.012, 0.020, 0.034, 1.0), metallic=0.18, roughness=0.20),
        "yellow": create_material("M_YellowAccent", (1.0, 0.58, 0.025, 1.0), metallic=0.02, roughness=0.34),
        "metal": create_material("M_WheelMetal", (0.16, 0.19, 0.24, 1.0), metallic=0.72, roughness=0.28),
        "lamp": create_material("M_LampWhite", (0.82, 0.94, 1.0, 1.0), metallic=0.0, roughness=0.18),
    }

    root = bpy.data.objects.new("BlueRallyRC", None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.25
    bpy.context.collection.objects.link(root)

    body_parts = [create_body_shell(materials["body"])]
    for side in (-1.0, 1.0):
        for y in (-0.72, 0.70):
            body_parts.append(
                create_uv_ellipsoid(
                    f"Fender_{side}_{y}",
                    (side * 0.73, y, 0.32),
                    (0.27, 0.48, 0.27),
                    materials["body"],
                    segments=28,
                    ring_count=14,
                )
            )
    body = join_objects("BodyShell", body_parts)

    canopy = create_uv_ellipsoid(
        "Canopy",
        (0.0, 0.04, 0.61),
        (0.54, 0.69, 0.31),
        materials["glass"],
        segments=28,
        ring_count=14,
    )

    aero_parts = [
        create_beveled_cube("FrontSplitter", (0.0, -1.25, 0.09), (1.20, 0.22, 0.10), materials["graphite"], 0.040, 2),
        create_beveled_cube("FrontIntake", (0.0, -1.245, 0.27), (0.72, 0.09, 0.15), materials["graphite"], 0.030, 2),
        create_beveled_cube("FrontAccent", (0.0, -1.365, 0.115), (0.68, 0.040, 0.040), materials["yellow"], 0.016, 2),
        create_beveled_cube("RearBumper", (0.0, 1.15, 0.14), (1.12, 0.19, 0.13), materials["graphite"], 0.040, 2),
        create_beveled_cube("SkirtLeft", (-0.76, 0.0, 0.10), (0.11, 1.58, 0.12), materials["graphite"], 0.025, 2),
        create_beveled_cube("SkirtRight", (0.76, 0.0, 0.10), (0.11, 1.58, 0.12), materials["graphite"], 0.025, 2),
        create_beveled_cube("SkirtAccentLeft", (-0.823, 0.0, 0.14), (0.025, 0.78, 0.032), materials["yellow"], 0.01, 1),
        create_beveled_cube("SkirtAccentRight", (0.823, 0.0, 0.14), (0.025, 0.78, 0.032), materials["yellow"], 0.01, 1),
    ]
    aero_kit = join_objects("AeroKit", aero_parts)

    headlight_parts: list[bpy.types.Object] = []
    for side in (-1.0, 1.0):
        headlight_parts.append(
            create_beveled_cube(
                f"HeadlightHousing_{side}",
                (side * 0.44, -1.105, 0.43),
                (0.33, 0.14, 0.12),
                materials["graphite"],
                0.025,
                2,
                rotation=(0.0, 0.0, math.radians(side * 7.0)),
            )
        )
        headlight_parts.append(
            create_beveled_cube(
                f"HeadlightLens_{side}",
                (side * 0.44, -1.183, 0.435),
                (0.245, 0.025, 0.067),
                materials["lamp"],
                0.014,
                2,
                rotation=(0.0, 0.0, math.radians(side * 7.0)),
            )
        )
    headlights = join_objects("Headlights", headlight_parts)

    wing_parts = [
        create_beveled_cube("WingDeck", (0.0, 0.94, 0.86), (1.30, 0.25, 0.09), materials["graphite"], 0.032, 2),
        create_beveled_cube("WingPostLeft", (-0.42, 0.91, 0.70), (0.080, 0.11, 0.30), materials["graphite"], 0.016, 1),
        create_beveled_cube("WingPostRight", (0.42, 0.91, 0.70), (0.080, 0.11, 0.30), materials["graphite"], 0.016, 1),
        create_beveled_cube("WingTipLeft", (-0.67, 0.94, 0.87), (0.085, 0.27, 0.19), materials["yellow"], 0.022, 2),
        create_beveled_cube("WingTipRight", (0.67, 0.94, 0.87), (0.085, 0.27, 0.19), materials["yellow"], 0.022, 2),
    ]
    wing = join_objects("RearWing", wing_parts)

    detail_parts = [
        create_cylinder("HoodClipLeft", (-0.23, -0.55, 0.59), 0.036, 0.045, materials["graphite"], 16, rotation=(0.0, 0.0, 0.0)),
        create_cylinder("HoodClipRight", (0.23, -0.55, 0.59), 0.036, 0.045, materials["graphite"], 16, rotation=(0.0, 0.0, 0.0)),
        create_cylinder("Antenna", (0.20, 0.28, 0.91), 0.019, 0.40, materials["graphite"], 12, rotation=(0.0, 0.0, 0.0)),
        create_uv_ellipsoid("AntennaTip", (0.20, 0.28, 1.12), (0.048, 0.048, 0.048), materials["yellow"], 16, 8),
        create_uv_ellipsoid("MirrorLeft", (-0.65, -0.22, 0.58), (0.090, 0.060, 0.060), materials["graphite"], 16, 8),
        create_uv_ellipsoid("MirrorRight", (0.65, -0.22, 0.58), (0.090, 0.060, 0.060), materials["graphite"], 16, 8),
        create_beveled_cube("TailLightLeft", (-0.45, 1.105, 0.40), (0.25, 0.035, 0.09), materials["yellow"], 0.018, 2),
        create_beveled_cube("TailLightRight", (0.45, 1.105, 0.40), (0.25, 0.035, 0.09), materials["yellow"], 0.018, 2),
    ]
    details = join_objects("RCDetails", detail_parts)

    wheels = [
        create_wheel("Wheel_FL", (-0.91, -0.72, 0.12), -1.0, materials),
        create_wheel("Wheel_FR", (0.91, -0.72, 0.12), 1.0, materials),
        create_wheel("Wheel_RL", (-0.91, 0.70, 0.12), -1.0, materials),
        create_wheel("Wheel_RR", (0.91, 0.70, 0.12), 1.0, materials),
    ]

    model_objects = [body, canopy, aero_kit, headlights, wing, details, *wheels]
    parent_to_root(root, model_objects)
    triangulate_meshes(model_objects)
    for object_ in model_objects:
        object_.select_set(False)
    return root, model_objects, materials


def setup_preview(root: bpy.types.Object) -> None:
    bpy.ops.object.camera_add(location=(4.1, -5.4, 3.25))
    camera = bpy.context.object
    camera.name = "PreviewCamera"
    bpy.context.scene.camera = camera

    def point_at(object_: bpy.types.Object, target: tuple[float, float, float]) -> None:
        direction = bpy.mathutils.Vector(target) - object_.location
        object_.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    # mathutils is exposed through Blender's module namespace in supported versions.
    if not hasattr(bpy, "mathutils"):
        import mathutils

        direction = mathutils.Vector((0.0, 0.0, 0.42)) - camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    else:
        point_at(camera, (0.0, 0.0, 0.42))
    camera.data.lens = 56

    bpy.ops.object.light_add(type="AREA", location=(-3.0, -4.0, 6.0))
    key_light = bpy.context.object
    key_light.name = "PreviewKey"
    key_light.data.energy = 900.0
    key_light.data.shape = "DISK"
    key_light.data.size = 5.0

    bpy.ops.object.light_add(type="AREA", location=(3.5, 1.5, 3.2))
    fill_light = bpy.context.object
    fill_light.name = "PreviewFill"
    fill_light.data.energy = 520.0
    fill_light.data.size = 4.0

    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.275))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground_material = create_material("M_PreviewGround", (0.055, 0.065, 0.082, 1.0), roughness=0.62)
    ground.data.materials.append(ground_material)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.025, 0.035, 0.055)
    scene.render.image_settings.color_mode = "RGBA"
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


def write_report(model_objects: list[bpy.types.Object], materials: dict[str, bpy.types.Material]) -> None:
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
    setup_preview(root)


if __name__ == "__main__":
    main()
