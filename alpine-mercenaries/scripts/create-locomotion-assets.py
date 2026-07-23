import unreal


ASSET_FOLDER = "/Game/Alpine/Animations"
SKELETAL_MESH_PATH = "/Game/Characters/Mannequins/Meshes/SKM_Quinn_Simple"
LAND_ANIMATION_PATH = (
    "/Game/Characters/Mannequins/Anims/Unarmed/Jump/MM_Land"
)
WALK_ANIMATION_PATH = (
    "/Game/Characters/Mannequins/Anims/Unarmed/Walk/MF_Unarmed_Walk_Fwd"
)
CROUCH_SOURCE_FRAME = 3

CROUCH_BONE_WEIGHTS = {
    "pelvis": 1.0,
    "spine_01": 0.35,
    "spine_02": 0.25,
    "spine_03": 0.15,
    "spine_04": 0.1,
    "spine_05": 0.05,
    "thigh_l": 0.95,
    "calf_l": 0.9,
    "foot_l": 0.7,
    "ball_l": 0.5,
    "thigh_r": 0.95,
    "calf_r": 0.9,
    "foot_r": 0.7,
    "ball_r": 0.5,
}


def require_asset(asset_path):
    asset = unreal.load_asset(asset_path)
    if asset is None:
        raise RuntimeError(f"Required Unreal asset is missing: {asset_path}")
    return asset


def get_or_create_sequence(asset_name, skeleton):
    asset_path = f"{ASSET_FOLDER}/{asset_name}"
    existing = unreal.load_asset(asset_path)
    if existing is not None:
        if not isinstance(existing, unreal.AnimSequence):
            raise RuntimeError(f"Generated asset has the wrong type: {asset_path}")
        return existing

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    sequence = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name,
        ASSET_FOLDER,
        unreal.AnimSequence,
        factory,
    )
    if sequence is None:
        raise RuntimeError(f"Failed to create animation sequence: {asset_path}")
    return sequence


def configure_sequence(sequence, skeleton, frame_count, poses):
    controller = sequence.controller
    controller.remove_all_bone_tracks(False)
    controller.set_frame_rate(unreal.FrameRate(numerator=30, denominator=1), False)
    controller.set_number_of_frames(unreal.FrameNumber(value=frame_count), False)

    bone_names = unreal.AnimPoseExtensions.get_bone_names(poses[0])
    for bone_name in bone_names:
        positions = []
        rotations = []
        scales = []
        for pose in poses:
            transform = unreal.AnimPoseExtensions.get_bone_pose(
                pose,
                bone_name,
                unreal.AnimPoseSpaces.LOCAL,
            )
            positions.append(transform.translation)
            rotations.append(transform.rotation.normalized())
            scales.append(transform.scale3d)

        controller.add_bone_track(bone_name, False)
        if not controller.set_bone_track_keys(
            bone_name,
            positions,
            rotations,
            scales,
            False,
        ):
            raise RuntimeError(f"Failed to write bone track: {bone_name}")

    sequence.set_editor_property("enable_root_motion", False)
    if not unreal.EditorAssetLibrary.save_loaded_asset(sequence, False):
        raise RuntimeError(f"Failed to save generated animation: {sequence.get_path_name()}")


def make_crouched_walk_pose(source_pose, reference_pose, crouch_pose):
    output_pose = source_pose.copy()
    identity_rotation = unreal.Quat()
    for bone_name, weight in CROUCH_BONE_WEIGHTS.items():
        source = unreal.AnimPoseExtensions.get_bone_pose(
            source_pose,
            bone_name,
            unreal.AnimPoseSpaces.LOCAL,
        )
        reference = unreal.AnimPoseExtensions.get_bone_pose(
            reference_pose,
            bone_name,
            unreal.AnimPoseSpaces.LOCAL,
        )
        crouch = unreal.AnimPoseExtensions.get_bone_pose(
            crouch_pose,
            bone_name,
            unreal.AnimPoseSpaces.LOCAL,
        )

        rotation_delta = crouch.rotation.multiply(reference.rotation.inversed())
        rotation_weight = 0.15 if bone_name == "pelvis" else weight
        weighted_delta = identity_rotation.slerp_quat(
            rotation_delta,
            rotation_weight,
        )
        output = source.copy()
        output.rotation = weighted_delta.multiply(source.rotation).normalized()
        output.translation = source.translation + (
            crouch.translation - reference.translation
        ) * weight
        output_pose = unreal.AnimPoseExtensions.set_bone_pose(
            output_pose,
            output,
            bone_name,
            unreal.AnimPoseSpaces.LOCAL,
        )
    return output_pose


def validate_crouch_pose(sequence, frame_index):
    options = unreal.AnimPoseEvaluationOptions()
    options.optional_skeletal_mesh = require_asset(SKELETAL_MESH_PATH)
    pose = unreal.AnimPoseExtensions.get_anim_pose_at_frame(
        sequence,
        frame_index,
        options,
    )
    pelvis = unreal.AnimPoseExtensions.get_bone_pose(
        pose,
        "pelvis",
        unreal.AnimPoseSpaces.WORLD,
    ).translation
    head = unreal.AnimPoseExtensions.get_bone_pose(
        pose,
        "head",
        unreal.AnimPoseSpaces.WORLD,
    ).translation
    if not 50.0 <= pelvis.z <= 86.0:
        raise RuntimeError(
            f"Generated crouch pelvis height is invalid: {pelvis.z:.2f}"
        )
    if head.z - pelvis.z < 35.0:
        raise RuntimeError(
            "Generated crouch pose is prone instead of upright: "
            f"pelvis={pelvis.z:.2f}, head={head.z:.2f}, "
            f"head-pelvis={head.z - pelvis.z:.2f}"
        )
    unreal.log(
        f"Validated {sequence.get_name()}: pelvis={pelvis.z:.1f}, "
        f"head={head.z:.1f}"
    )


def main():
    skeletal_mesh = require_asset(SKELETAL_MESH_PATH)
    skeleton = skeletal_mesh.skeleton
    land_animation = require_asset(LAND_ANIMATION_PATH)
    walk_animation = require_asset(WALK_ANIMATION_PATH)

    options = unreal.AnimPoseEvaluationOptions()
    options.optional_skeletal_mesh = skeletal_mesh
    crouch_pose = unreal.AnimPoseExtensions.get_anim_pose_at_frame(
        land_animation,
        CROUCH_SOURCE_FRAME,
        options,
    )
    reference_pose = unreal.AnimPoseExtensions.get_reference_pose(skeleton)

    idle_sequence = get_or_create_sequence("AM_Crouch_Idle", skeleton)
    configure_sequence(
        idle_sequence,
        skeleton,
        1,
        [crouch_pose, crouch_pose],
    )

    walk_frame_count = walk_animation.data_model_interface.get_number_of_frames()
    crouched_walk_poses = []
    for frame_index in range(walk_frame_count + 1):
        source_pose = unreal.AnimPoseExtensions.get_anim_pose_at_frame(
            walk_animation,
            frame_index,
            options,
        )
        crouched_walk_poses.append(
            make_crouched_walk_pose(source_pose, reference_pose, crouch_pose)
        )

    walk_sequence = get_or_create_sequence("AM_Crouch_Walk_Fwd", skeleton)
    configure_sequence(
        walk_sequence,
        skeleton,
        walk_frame_count,
        crouched_walk_poses,
    )

    validate_crouch_pose(idle_sequence, 0)
    validate_crouch_pose(walk_sequence, 0)
    unreal.log(
        "Generated crouch locomotion assets: "
        f"{idle_sequence.get_path_name()}, {walk_sequence.get_path_name()}"
    )


main()
