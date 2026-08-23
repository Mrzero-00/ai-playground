using System.Linq;
using RCWeeklyTimeAttack.Bootstrap;
using RCWeeklyTimeAttack.Input;
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

        [MenuItem("RC Time Attack/V0.1/Open Sandbox", priority = 1)]
        public static void OpenSandbox()
        {
            EnsureSceneExists();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
        }

        [MenuItem("RC Time Attack/V0.1/Rebuild Sandbox Scene", priority = 2)]
        public static void RebuildSandbox()
        {
            if (!EditorUtility.DisplayDialog(
                    "Rebuild V0.1 Sandbox",
                    "V01_Sandbox 씬을 Bootstrap 한 개만 포함한 상태로 다시 만듭니다.",
                    "Rebuild",
                    "Cancel"))
            {
                return;
            }

            RebuildScene();
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
