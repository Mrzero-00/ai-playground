import unreal


MAP_PATH = "/Game/ThirdPerson/Lvl_ThirdPerson"
GAME_MODE_PATH = "/Script/AlpineMercenaries.AlpineGameMode"


world = unreal.EditorLoadingAndSavingUtils.load_map(MAP_PATH)
if world is None:
    raise RuntimeError(f"맵을 열 수 없습니다: {MAP_PATH}")

game_mode_class = unreal.load_class(None, GAME_MODE_PATH)
if game_mode_class is None:
    raise RuntimeError(f"게임 모드 클래스를 열 수 없습니다: {GAME_MODE_PATH}")

world_settings = world.get_world_settings()
world_settings.set_editor_property("default_game_mode", game_mode_class)

if not unreal.EditorAssetLibrary.save_asset(MAP_PATH, only_if_is_dirty=False):
    raise RuntimeError(f"맵 저장에 실패했습니다: {MAP_PATH}")

unreal.log(f"Configured {MAP_PATH} to use {GAME_MODE_PATH}")
