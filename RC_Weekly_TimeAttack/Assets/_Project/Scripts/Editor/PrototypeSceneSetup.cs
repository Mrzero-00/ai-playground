using System.Linq;
using RCWeeklyTimeAttack.Bootstrap;
using RCWeeklyTimeAttack.Input;
using RCWeeklyTimeAttack.Race;
using RCWeeklyTimeAttack.Vehicle;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace RCWeeklyTimeAttack.Editor
{
    [InitializeOnLoad]
    public static class PrototypeSceneSetup
    {
        private const string ScenePath = "Assets/_Project/Scenes/V01_Sandbox.unity";
        private const string TuningPath = "Assets/_Project/Settings/CarTuning_V01.asset";

        static PrototypeSceneSetup()
        {
            EditorApplication.delayCall += EnsureProjectSetup;
        }

        [MenuItem("RC Time Attack/Playtest/Open Sandbox", priority = 1)]
        public static void OpenSandbox()
        {
            EnsureSceneExists();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
        }

        [MenuItem("RC Time Attack/Playtest/Rebuild Sandbox Scene", priority = 2)]
        public static void RebuildSandbox()
        {
            if (!EditorUtility.DisplayDialog(
                    "Rebuild Playtest Sandbox",
                    "플레이테스트 씬을 Bootstrap 한 개만 포함한 상태로 다시 만듭니다.",
                    "Rebuild",
                    "Cancel"))
            {
                return;
            }

            RebuildScene();
        }

        [MenuItem("RC Time Attack/Playtest/Clear Local Records", priority = 20)]
        public static void ClearLocalRecords()
        {
            if (!EditorUtility.DisplayDialog(
                    "Clear Local Playtest Records",
                    "현재 Playtest Weekly Track의 Top 5와 My Best Ghost를 삭제합니다.",
                    "Clear",
                    "Cancel"))
            {
                return;
            }

            string storageKey = new LocalWeeklyTrackProvider().Current.StorageKey;
            PlayerPrefs.DeleteKey($"rc-weekly:times:{storageKey}");
            PlayerPrefs.DeleteKey($"rc-weekly:replay:{storageKey}");
            PlayerPrefs.Save();
            Debug.Log("RC Weekly Time Attack local playtest records cleared.");
        }

        private static void EnsureProjectSetup()
        {
            if (EditorApplication.isCompiling || EditorApplication.isPlayingOrWillChangePlaymode)
            {
                return;
            }

            EnsureSceneExists();
            EnsureBuildSettings();
        }

        private static void EnsureSceneExists()
        {
            SceneAsset sceneAsset = AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath);
            if (sceneAsset == null)
            {
                RebuildScene();
            }
        }

        private static void RebuildScene()
        {
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            GameObject bootstrap = new("PrototypeBootstrap");
            PrototypeBootstrap bootstrapComponent = bootstrap.AddComponent<PrototypeBootstrap>();
            bootstrapComponent.Configure(
                AssetDatabase.LoadAssetAtPath<CarTuning>(TuningPath),
                SteeringMode.Arrow);
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EnsureBuildSettings();
            Selection.activeGameObject = bootstrap;
        }

        private static void EnsureBuildSettings()
        {
            EditorBuildSettingsScene[] current = EditorBuildSettings.scenes;
            if (current.Any(scene => scene.path == ScenePath && scene.enabled))
            {
                return;
            }

            EditorBuildSettingsScene[] withoutDuplicate = current
                .Where(scene => scene.path != ScenePath)
                .ToArray();
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) }
                .Concat(withoutDuplicate)
                .ToArray();
        }
    }
}
