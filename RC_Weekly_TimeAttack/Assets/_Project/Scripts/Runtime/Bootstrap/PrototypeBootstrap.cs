using RCWeeklyTimeAttack.CameraSystem;
using RCWeeklyTimeAttack.Input;
using RCWeeklyTimeAttack.Vehicle;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

namespace RCWeeklyTimeAttack.Bootstrap
{
    [DefaultExecutionOrder(-1000)]
    public sealed class PrototypeBootstrap : MonoBehaviour
    {
        private const string RuntimeRootName = "V01_Runtime";

        [SerializeField] private CarTuning tuning;
        [SerializeField] private SteeringMode initialMode = SteeringMode.Arrow;

        private static Font runtimeFont;

        public void Configure(CarTuning carTuning, SteeringMode steeringMode)
        {
            tuning = carTuning;
            initialMode = steeringMode;
        }

        private void Awake()
        {
            if (GameObject.Find(RuntimeRootName) != null)
            {
                return;
            }

            Application.targetFrameRate = 60;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;

            GameObject runtimeRoot = new(RuntimeRootName);
            CreateLighting(runtimeRoot.transform);
            CreateArena(runtimeRoot.transform);

            CarRuntime car = CreateCar(runtimeRoot.transform);
            CreateRaceCamera(runtimeRoot.transform, car.CameraTarget);
            CreateDriveUi(runtimeRoot.transform, car.TouchInput, car.InputRouter, car.Telemetry, initialMode);
        }

        private CarRuntime CreateCar(Transform parent)
        {
            GameObject car = new("CubeCar");
            car.transform.SetParent(parent);
            car.transform.SetPositionAndRotation(new Vector3(0f, 0.4f, -25f), Quaternion.identity);

            BoxCollider carCollider = car.AddComponent<BoxCollider>();
            carCollider.size = new Vector3(1.45f, 0.65f, 2.35f);

            Rigidbody body = car.AddComponent<Rigidbody>();
            body.mass = 1.15f;
            body.linearDamping = 0.05f;
            body.angularDamping = 5f;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            body.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
            body.centerOfMass = new Vector3(0f, -0.25f, 0f);

            car.AddComponent<KeyboardVehicleInputSource>();
            TouchVehicleInputSource touch = car.AddComponent<TouchVehicleInputSource>();
            VehicleTelemetry telemetry = car.AddComponent<VehicleTelemetry>();
            VehicleInputRouter router = car.AddComponent<VehicleInputRouter>();
            CubeCarController controller = car.AddComponent<CubeCarController>();
            controller.Configure(tuning);
            router.RefreshSources();

            CreateCarVisual(car.transform, "Body", Vector3.zero,
                new Vector3(1.45f, 0.65f, 2.35f), new Color(0.08f, 0.46f, 0.95f));
            CreateCarVisual(car.transform, "Cabin", new Vector3(0f, 0.68f, -0.08f),
                new Vector3(0.78f, 0.48f, 0.92f), new Color(0.04f, 0.12f, 0.23f));
            CreateCarVisual(car.transform, "FrontMarker", new Vector3(0f, 0.28f, 0.86f),
                new Vector3(0.52f, 0.12f, 0.18f), new Color(1f, 0.82f, 0.12f));

            Transform cameraTarget = new GameObject("CameraTarget").transform;
            cameraTarget.SetParent(car.transform, false);
            cameraTarget.localPosition = new Vector3(0f, 1.2f, 1.4f);

            return new CarRuntime(router, touch, telemetry, cameraTarget);
        }

        private static void CreateCarVisual(
            Transform parent,
            string objectName,
            Vector3 localPosition,
            Vector3 localScale,
            Color color)
        {
            GameObject visual = GameObject.CreatePrimitive(PrimitiveType.Cube);
            visual.name = objectName;
            visual.transform.SetParent(parent, false);
            visual.transform.localPosition = localPosition;
            visual.transform.localRotation = Quaternion.identity;
            visual.transform.localScale = localScale;
            Collider visualCollider = visual.GetComponent<Collider>();
            visualCollider.enabled = false;
            Destroy(visualCollider);
            SetColor(visual, color);
        }

        private static void CreateRaceCamera(Transform parent, Transform target)
        {
            GameObject cameraObject = new("RaceCamera");
            cameraObject.transform.SetParent(parent);
            cameraObject.tag = "MainCamera";

            Camera raceCamera = cameraObject.AddComponent<Camera>();
            raceCamera.fieldOfView = 58f;
            raceCamera.nearClipPlane = 0.1f;
            raceCamera.farClipPlane = 180f;
            raceCamera.backgroundColor = new Color(0.08f, 0.12f, 0.16f);
            raceCamera.clearFlags = CameraClearFlags.SolidColor;
            cameraObject.AddComponent<AudioListener>();

            FollowCamera followCamera = cameraObject.AddComponent<FollowCamera>();
            followCamera.Configure(target);
        }

        private static void CreateArena(Transform parent)
        {
            GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground";
            ground.transform.SetParent(parent);
            ground.transform.localScale = new Vector3(6f, 1f, 10f);
            SetColor(ground, new Color(0.22f, 0.25f, 0.28f));

            CreateBox(parent, "Wall_Left", new Vector3(-30f, 1f, 0f), new Vector3(1f, 2f, 100f),
                new Color(0.78f, 0.82f, 0.86f), true);
            CreateBox(parent, "Wall_Right", new Vector3(30f, 1f, 0f), new Vector3(1f, 2f, 100f),
                new Color(0.78f, 0.82f, 0.86f), true);
            CreateBox(parent, "Wall_Top", new Vector3(0f, 1f, 50f), new Vector3(60f, 2f, 1f),
                new Color(0.78f, 0.82f, 0.86f), true);
            CreateBox(parent, "Wall_Bottom", new Vector3(0f, 1f, -50f), new Vector3(60f, 2f, 1f),
                new Color(0.78f, 0.82f, 0.86f), true);

            CreateBox(parent, "StartLine", new Vector3(0f, 0.025f, -20f), new Vector3(14f, 0.05f, 0.7f),
                new Color(0.94f, 0.94f, 0.94f), false);
            CreateBox(parent, "PracticeIslandA", new Vector3(-10f, 0.6f, 7f), new Vector3(8f, 1.2f, 4f),
                new Color(0.9f, 0.34f, 0.2f), true);
            CreateBox(parent, "PracticeIslandB", new Vector3(11f, 0.6f, 23f), new Vector3(7f, 1.2f, 5f),
                new Color(0.9f, 0.34f, 0.2f), true);
        }

        private static void CreateBox(
            Transform parent,
            string objectName,
            Vector3 position,
            Vector3 scale,
            Color color,
            bool collision)
        {
            GameObject box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = objectName;
            box.transform.SetParent(parent);
            box.transform.SetPositionAndRotation(position, Quaternion.identity);
            box.transform.localScale = scale;
            Collider boxCollider = box.GetComponent<Collider>();
            if (!collision)
            {
                boxCollider.enabled = false;
                Destroy(boxCollider);
            }
            SetColor(box, color);
        }

        private static void CreateLighting(Transform parent)
        {
            GameObject lightObject = new("Directional Light");
            lightObject.transform.SetParent(parent);
            lightObject.transform.rotation = Quaternion.Euler(48f, -32f, 0f);
            Light light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.15f;
            light.color = new Color(1f, 0.96f, 0.9f);
            light.shadows = LightShadows.Soft;
        }

        private static void CreateDriveUi(
            Transform parent,
            TouchVehicleInputSource touchInput,
            VehicleInputRouter inputRouter,
            VehicleTelemetry telemetry,
            SteeringMode initialSteeringMode)
        {
            EnsureEventSystem(parent);

            GameObject canvasObject = new("DriveCanvas", typeof(RectTransform), typeof(Canvas),
                typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(parent);
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;

            CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            RectTransform safeArea = CreateRect("SafeArea", canvasObject.transform);
            StretchFull(safeArea);
            safeArea.gameObject.AddComponent<SafeAreaFitter>();

            GameObject arrowGroup = CreateAnchoredGroup(
                "ArrowControls", safeArea, new Vector2(420f, 180f),
                new Vector2(44f, 44f), new Vector2(0f, 0f));
            ArrowSteeringInput arrowInput = arrowGroup.AddComponent<ArrowSteeringInput>();

            CreateHoldButton("ArrowLeft", arrowGroup.transform, "◀", new Vector2(0f, 0f),
                new Vector2(180f, 160f), DriveButtonAction.ArrowLeft, touchInput, arrowInput);
            CreateHoldButton("ArrowRight", arrowGroup.transform, "▶", new Vector2(205f, 0f),
                new Vector2(180f, 160f), DriveButtonAction.ArrowRight, touchInput, arrowInput);

            GameObject wheelGroup = CreateAnchoredGroup(
                "WheelControls", safeArea, new Vector2(300f, 300f),
                new Vector2(204f, 188f), new Vector2(0f, 0f));
            ((RectTransform)wheelGroup.transform).pivot = new Vector2(0.5f, 0.5f);
            RectTransform wheelFace = CreateRect("WheelFace", wheelGroup.transform);
            StretchFull(wheelFace);
            Image wheelImage = wheelFace.gameObject.AddComponent<Image>();
            wheelImage.color = new Color(0.12f, 0.52f, 1f, 0.52f);
            wheelImage.raycastTarget = true;
            VirtualSteeringWheelInput wheelInput = wheelGroup.AddComponent<VirtualSteeringWheelInput>();
            wheelInput.Configure(wheelFace);
            CreateWheelSpoke(wheelFace, new Vector2(250f, 18f), 0f);
            CreateWheelSpoke(wheelFace, new Vector2(250f, 18f), 90f);

            CreateHoldButton("Gas", safeArea, "GAS", new Vector2(-44f, 44f),
                new Vector2(220f, 190f), DriveButtonAction.Gas, touchInput, arrowInput,
                new Vector2(1f, 0f), new Vector2(1f, 0f), new Color(0.1f, 0.72f, 0.36f, 0.82f));
            CreateHoldButton("Brake", safeArea, "BRAKE", new Vector2(-286f, 44f),
                new Vector2(210f, 160f), DriveButtonAction.Brake, touchInput, arrowInput,
                new Vector2(1f, 0f), new Vector2(1f, 0f), new Color(0.94f, 0.27f, 0.2f, 0.82f));

            GameObject modeButton = CreateClickButton(
                "ModeButton", safeArea, new Vector2(44f, -44f), new Vector2(270f, 72f),
                new Vector2(0f, 1f), new Vector2(0f, 1f), out Button button, out Text modeLabel);

            Text hudText = CreateText("Telemetry", safeArea, string.Empty, 30, TextAnchor.UpperCenter);
            RectTransform hudRect = hudText.rectTransform;
            hudRect.anchorMin = new Vector2(0.5f, 1f);
            hudRect.anchorMax = new Vector2(0.5f, 1f);
            hudRect.pivot = new Vector2(0.5f, 1f);
            hudRect.anchoredPosition = new Vector2(0f, -36f);
            hudRect.sizeDelta = new Vector2(760f, 100f);
            Outline outline = hudText.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(0f, 0f, 0f, 0.8f);
            outline.effectDistance = new Vector2(2f, -2f);

            SteeringModeController modeController = canvasObject.AddComponent<SteeringModeController>();
            modeController.Configure(
                arrowGroup,
                wheelGroup,
                arrowInput,
                wheelInput,
                touchInput,
                modeLabel,
                initialSteeringMode);
            button.onClick.AddListener(modeController.Toggle);

            PrototypeHud hud = canvasObject.AddComponent<PrototypeHud>();
            hud.Configure(hudText, telemetry, modeController);

            inputRouter.RefreshSources();
            _ = modeButton;
        }

        private static void EnsureEventSystem(Transform parent)
        {
            if (FindAnyObjectByType<EventSystem>() != null)
            {
                return;
            }

            GameObject eventSystemObject = new("EventSystem");
            eventSystemObject.transform.SetParent(parent);
            eventSystemObject.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
            eventSystemObject.AddComponent<InputSystemUIInputModule>();
#else
            eventSystemObject.AddComponent<StandaloneInputModule>();
#endif
        }

        private static GameObject CreateAnchoredGroup(
            string objectName,
            Transform parent,
            Vector2 size,
            Vector2 position,
            Vector2 anchor)
        {
            RectTransform rect = CreateRect(objectName, parent);
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            return rect.gameObject;
        }

        private static void CreateHoldButton(
            string objectName,
            Transform parent,
            string label,
            Vector2 position,
            Vector2 size,
            DriveButtonAction action,
            TouchVehicleInputSource touchInput,
            ArrowSteeringInput arrowInput,
            Vector2? anchor = null,
            Vector2? pivot = null,
            Color? color = null)
        {
            RectTransform rect = CreateRect(objectName, parent);
            Vector2 resolvedAnchor = anchor ?? new Vector2(0f, 0f);
            rect.anchorMin = resolvedAnchor;
            rect.anchorMax = resolvedAnchor;
            rect.pivot = pivot ?? new Vector2(0f, 0f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;

            Image image = rect.gameObject.AddComponent<Image>();
            image.color = color ?? new Color(0.12f, 0.52f, 1f, 0.78f);
            image.raycastTarget = true;

            HoldDriveButton holdButton = rect.gameObject.AddComponent<HoldDriveButton>();
            holdButton.Configure(action, touchInput, arrowInput);

            Text text = CreateText("Label", rect, label, 40, TextAnchor.MiddleCenter);
            StretchFull(text.rectTransform);
            text.raycastTarget = false;
        }

        private static GameObject CreateClickButton(
            string objectName,
            Transform parent,
            Vector2 position,
            Vector2 size,
            Vector2 anchor,
            Vector2 pivot,
            out Button button,
            out Text label)
        {
            RectTransform rect = CreateRect(objectName, parent);
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = pivot;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;

            Image image = rect.gameObject.AddComponent<Image>();
            image.color = new Color(0.06f, 0.1f, 0.16f, 0.78f);
            button = rect.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            label = CreateText("Label", rect, "MODE: ARROW", 28, TextAnchor.MiddleCenter);
            StretchFull(label.rectTransform);
            label.raycastTarget = false;
            return rect.gameObject;
        }

        private static void CreateWheelSpoke(Transform parent, Vector2 size, float angle)
        {
            RectTransform spoke = CreateRect("Spoke", parent);
            spoke.anchorMin = new Vector2(0.5f, 0.5f);
            spoke.anchorMax = new Vector2(0.5f, 0.5f);
            spoke.pivot = new Vector2(0.5f, 0.5f);
            spoke.anchoredPosition = Vector2.zero;
            spoke.sizeDelta = size;
            spoke.localRotation = Quaternion.Euler(0f, 0f, angle);
            Image image = spoke.gameObject.AddComponent<Image>();
            image.color = new Color(1f, 1f, 1f, 0.72f);
            image.raycastTarget = false;
        }

        private static Text CreateText(
            string objectName,
            Transform parent,
            string value,
            int fontSize,
            TextAnchor alignment)
        {
            RectTransform rect = CreateRect(objectName, parent);
            Text text = rect.gameObject.AddComponent<Text>();
            text.font = GetRuntimeFont();
            text.text = value;
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = Color.white;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }

        private static Font GetRuntimeFont()
        {
            if (runtimeFont == null)
            {
                runtimeFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }

            return runtimeFont;
        }

        private static RectTransform CreateRect(string objectName, Transform parent)
        {
            GameObject uiObject = new(objectName, typeof(RectTransform));
            uiObject.transform.SetParent(parent, false);
            return uiObject.GetComponent<RectTransform>();
        }

        private static void StretchFull(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        private static void SetColor(GameObject target, Color color)
        {
            Renderer renderer = target.GetComponent<Renderer>();
            if (renderer == null)
            {
                return;
            }

            // CreatePrimitive supplies Unity's built-in default material, which keeps
            // its shader in WebGL builds. Accessing .material creates a colorable instance.
            Material material = renderer.material;
            if (material == null)
            {
                return;
            }
            if (material.HasProperty("_BaseColor"))
            {
                material.SetColor("_BaseColor", color);
            }
            if (material.HasProperty("_Color"))
            {
                material.SetColor("_Color", color);
            }
            renderer.sharedMaterial = material;
        }

        private readonly struct CarRuntime
        {
            public VehicleInputRouter InputRouter { get; }
            public TouchVehicleInputSource TouchInput { get; }
            public VehicleTelemetry Telemetry { get; }
            public Transform CameraTarget { get; }

            public CarRuntime(
                VehicleInputRouter inputRouter,
                TouchVehicleInputSource touchInput,
                VehicleTelemetry telemetry,
                Transform cameraTarget)
            {
                InputRouter = inputRouter;
                TouchInput = touchInput;
                Telemetry = telemetry;
                CameraTarget = cameraTarget;
            }
        }
    }
}
