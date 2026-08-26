using RCWeeklyTimeAttack.CameraSystem;
using RCWeeklyTimeAttack.Input;
using RCWeeklyTimeAttack.Race;
using RCWeeklyTimeAttack.Replay;
using RCWeeklyTimeAttack.Vehicle;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.UI;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

namespace RCWeeklyTimeAttack.Bootstrap
{
    [DefaultExecutionOrder(-1000)]
    public sealed class PrototypeBootstrap : MonoBehaviour
    {
        private const string RuntimeRootName = "V04_Playtest_Runtime";
        private const float MiniRcScale = 0.68f;
        private static readonly Vector3 StartPosition = new(-25f, 0.4f, -16f);
        private static readonly Quaternion StartRotation = Quaternion.Euler(0f, 180f, 0f);

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
            int checkpointCount = CreatePlaytestTrack(runtimeRoot.transform);

            CarRuntime car = CreateCar(runtimeRoot.transform);
            WeeklyTrackManifest manifest = new LocalWeeklyTrackProvider().Current;
            RaceSession raceSession = car.Root.AddComponent<RaceSession>();
            raceSession.Configure(manifest, checkpointCount, StartPosition, StartRotation);

            ReplayRecorder recorder = car.Root.AddComponent<ReplayRecorder>();
            float replaySpeedLimit = car.Controller.Tuning != null
                ? car.Controller.Tuning.MaxForwardSpeed
                : 22f;
            recorder.Configure(raceSession, car.Telemetry, manifest, replaySpeedLimit);

            Transform ghostVisual = CreateGhostVisual(runtimeRoot.transform);
            GhostPlayback ghostPlayback = runtimeRoot.AddComponent<GhostPlayback>();
            ghostPlayback.Configure(raceSession, ghostVisual, manifest);

            CreateRaceCamera(runtimeRoot.transform, car.CameraTarget);
            CreateDriveUi(
                runtimeRoot.transform,
                car.TouchInput,
                car.InputRouter,
                car.Telemetry,
                raceSession,
                ghostPlayback,
                recorder,
                initialMode);
        }

        private CarRuntime CreateCar(Transform parent)
        {
            GameObject car = new("BlueRallyRC");
            car.transform.SetParent(parent);
            car.transform.SetPositionAndRotation(StartPosition, StartRotation);

            BoxCollider carCollider = car.AddComponent<BoxCollider>();
            carCollider.center = Vector3.zero;
            carCollider.size = new Vector3(1.85f, 0.68f, 2.55f) * MiniRcScale;

            Rigidbody body = car.AddComponent<Rigidbody>();
            body.mass = 0.8f;
            body.linearDamping = 0.05f;
            body.angularDamping = 5f;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            body.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
            body.centerOfMass = new Vector3(0f, -0.12f, 0f);

            car.AddComponent<KeyboardVehicleInputSource>();
            TouchVehicleInputSource touch = car.AddComponent<TouchVehicleInputSource>();
            VehicleTelemetry telemetry = car.AddComponent<VehicleTelemetry>();
            VehicleInputRouter router = car.AddComponent<VehicleInputRouter>();
            CubeCarController controller = car.AddComponent<CubeCarController>();
            controller.Configure(tuning);
            router.RefreshSources();

            BlueRallyVisualInstance visual = BlueRallyCarVisual.Create(car.transform, false, MiniRcScale);
            RcWheelVisualAnimator wheelAnimator = car.AddComponent<RcWheelVisualAnimator>();
            wheelAnimator.ConfigurePlayer(body, router, visual, MiniRcScale);

            Transform cameraTarget = new GameObject("CameraTarget").transform;
            cameraTarget.SetParent(car.transform, false);
            cameraTarget.localPosition = new Vector3(0f, 0.82f, 0.95f);

            return new CarRuntime(car, controller, router, touch, telemetry, cameraTarget);
        }

        private static void CreateRaceCamera(Transform parent, Transform target)
        {
            GameObject cameraObject = new("RaceCamera");
            cameraObject.transform.SetParent(parent);
            cameraObject.tag = "MainCamera";

            Camera raceCamera = cameraObject.AddComponent<Camera>();
            raceCamera.fieldOfView = 64f;
            raceCamera.nearClipPlane = 0.1f;
            raceCamera.farClipPlane = 180f;
            raceCamera.backgroundColor = new Color(0.08f, 0.12f, 0.16f);
            raceCamera.clearFlags = CameraClearFlags.SolidColor;
            cameraObject.AddComponent<AudioListener>();

            FollowCamera followCamera = cameraObject.AddComponent<FollowCamera>();
            followCamera.Configure(target);
        }

        private static int CreatePlaytestTrack(Transform parent)
        {
            GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "TechnicalTrackSurface";
            ground.transform.SetParent(parent);
            ground.transform.localScale = new Vector3(7f, 1f, 9f);
            SetColor(ground, new Color(0.13f, 0.16f, 0.19f));

            CreateBox(parent, "Wall_Left", new Vector3(-34f, 1f, 0f), new Vector3(1f, 2f, 88f),
                new Color(0.78f, 0.82f, 0.86f), true);
            CreateBox(parent, "Wall_Right", new Vector3(34f, 1f, 0f), new Vector3(1f, 2f, 88f),
                new Color(0.78f, 0.82f, 0.86f), true);
            CreateBox(parent, "Wall_Top", new Vector3(0f, 1f, 44f), new Vector3(68f, 2f, 1f),
                new Color(0.78f, 0.82f, 0.86f), true);
            CreateBox(parent, "Wall_Bottom", new Vector3(0f, 1f, -44f), new Vector3(68f, 2f, 1f),
                new Color(0.78f, 0.82f, 0.86f), true);

            Color islandColor = new(0.2f, 0.39f, 0.24f);
            Color barrierColor = new(0.88f, 0.3f, 0.12f);
            CreateBox(parent, "LowerIsland", new Vector3(-6f, 0.6f, -27f), new Vector3(25f, 1.2f, 8f),
                islandColor, true);
            CreateBox(parent, "RightLowerIsland", new Vector3(15f, 0.6f, -10f), new Vector3(12f, 1.2f, 19f),
                islandColor, true);
            CreateBox(parent, "CenterLeftIsland", new Vector3(-6f, 0.6f, -1.5f), new Vector3(14f, 1.2f, 14f),
                islandColor, true);
            CreateBox(parent, "TopMiddleBarrier", new Vector3(3f, 0.6f, 20f), new Vector3(16f, 1.2f, 6f),
                barrierColor, true);
            CreateBox(parent, "TopRightIsland", new Vector3(20f, 0.6f, 17f), new Vector3(9f, 1.2f, 8f),
                islandColor, true);
            CreateBox(parent, "LeftHairpinIsland", new Vector3(-20f, 0.6f, 1f), new Vector3(7f, 1.2f, 12f),
                barrierColor, true);

            Color markerColor = new(0.72f, 0.76f, 0.8f);
            CreateRouteMarker(parent, "Route_01", new Vector3(-25f, 0f, -16f), new Vector3(-25f, 0f, -35f), markerColor);
            CreateRouteMarker(parent, "Route_02", new Vector3(-25f, 0f, -36f), new Vector3(5f, 0f, -36f), markerColor);
            CreateRouteMarker(parent, "Route_03", new Vector3(5f, 0f, -36f), new Vector3(27f, 0f, -28f), markerColor);
            CreateRouteMarker(parent, "Route_04", new Vector3(29f, 0f, -28f), new Vector3(29f, 0f, 7f), markerColor);
            CreateRouteMarker(parent, "Route_05", new Vector3(29f, 0f, 7f), new Vector3(2f, 0f, 2f), markerColor);
            CreateRouteMarker(parent, "Route_06", new Vector3(2f, 0f, 2f), new Vector3(-12f, 0f, 14f), markerColor);
            CreateRouteMarker(parent, "Route_07", new Vector3(-12f, 0f, 14f), new Vector3(-10f, 0f, 28f), markerColor);
            CreateRouteMarker(parent, "Route_08", new Vector3(-10f, 0f, 29f), new Vector3(27f, 0f, 25f), markerColor);
            CreateRouteMarker(parent, "Route_09", new Vector3(29f, 0f, 25f), new Vector3(29f, 0f, 10f), markerColor);
            CreateRouteMarker(parent, "Route_10", new Vector3(29f, 0f, 10f), new Vector3(0f, 0f, 14f), markerColor);
            CreateRouteMarker(parent, "Route_11", new Vector3(0f, 0f, 14f), new Vector3(-15f, 0f, 8f), markerColor);
            CreateRouteMarker(parent, "Route_12", new Vector3(-15f, 0f, 8f), new Vector3(-27f, 0f, 9f), markerColor);
            CreateRouteMarker(parent, "Route_13", new Vector3(-27f, 0f, 9f), new Vector3(-25f, 0f, -23f), markerColor);

            Color checkpointColor = new(0.1f, 0.63f, 1f);
            CreateRaceGate(parent, "Finish", 0, Vector3.back, new Vector3(-25f, 0.25f, -23f), 9f,
                new Color(1f, 0.86f, 0.16f));
            CreateRaceGate(parent, "CP_1", 1, Vector3.back, new Vector3(-25f, 0.25f, -35f), 9f, checkpointColor);
            CreateRaceGate(parent, "CP_2", 2, Vector3.right, new Vector3(5f, 0.25f, -36f), 9f, checkpointColor);
            CreateRaceGate(parent, "CP_3", 3, Vector3.right, new Vector3(27f, 0.25f, -28f), 8f, checkpointColor);
            CreateRaceGate(parent, "CP_4", 4, Vector3.forward, new Vector3(29f, 0.25f, -8f), 8f, checkpointColor);
            CreateRaceGate(parent, "CP_5", 5, Vector3.left, new Vector3(20f, 0.25f, 7f), 8f, checkpointColor);
            CreateRaceGate(parent, "CP_6", 6, Vector3.left, new Vector3(2f, 0.25f, 2f), 7f, checkpointColor);
            CreateRaceGate(parent, "CP_7", 7, Vector3.forward, new Vector3(-12f, 0.25f, 14f), 7f, checkpointColor);
            CreateRaceGate(parent, "CP_8", 8, Vector3.right, new Vector3(4f, 0.25f, 29f), 8f, checkpointColor);
            CreateRaceGate(parent, "CP_9", 9, Vector3.back, new Vector3(27f, 0.25f, 25f), 8f, checkpointColor);
            CreateRaceGate(parent, "CP_10", 10, Vector3.left, new Vector3(18f, 0.25f, 10f), 7f, checkpointColor);
            CreateRaceGate(parent, "CP_11", 11, Vector3.left, new Vector3(0f, 0.25f, 14f), 7f, checkpointColor);
            CreateRaceGate(parent, "CP_12", 12, Vector3.left, new Vector3(-15f, 0.25f, 8f), 7f, checkpointColor);
            CreateRaceGate(parent, "CP_13", 13, Vector3.back, new Vector3(-27f, 0.25f, -5f), 8f, checkpointColor);

            return 13;
        }

        private static void CreateRouteMarker(
            Transform parent,
            string objectName,
            Vector3 from,
            Vector3 to,
            Color color)
        {
            Vector3 delta = to - from;
            Vector3 center = (from + to) * 0.5f + Vector3.up * 0.025f;
            float yaw = Mathf.Atan2(delta.x, delta.z) * Mathf.Rad2Deg;
            GameObject marker = GameObject.CreatePrimitive(PrimitiveType.Cube);
            marker.name = objectName;
            marker.transform.SetParent(parent);
            marker.transform.SetPositionAndRotation(center, Quaternion.Euler(0f, yaw, 0f));
            marker.transform.localScale = new Vector3(0.16f, 0.05f, delta.magnitude);
            Collider markerCollider = marker.GetComponent<Collider>();
            markerCollider.enabled = false;
            Destroy(markerCollider);
            SetColor(marker, color);
        }

        private static void CreateRaceGate(
            Transform parent,
            string objectName,
            int gateIndex,
            Vector3 expectedDirection,
            Vector3 position,
            float width,
            Color color)
        {
            float yaw = Mathf.Atan2(expectedDirection.x, expectedDirection.z) * Mathf.Rad2Deg;
            GameObject gate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            gate.name = objectName;
            gate.transform.SetParent(parent);
            gate.transform.SetPositionAndRotation(position, Quaternion.Euler(0f, yaw, 0f));
            gate.transform.localScale = new Vector3(width, 0.5f, 0.6f);
            SetColor(gate, new Color(color.r, color.g, color.b, 0.72f));
            gate.AddComponent<RaceCheckpoint>().Configure(gateIndex, expectedDirection);
            CreateGateLabel(parent, gateIndex == 0 ? "FINISH" : $"CP {gateIndex}", position);
        }

        private static void CreateGateLabel(Transform parent, string value, Vector3 position)
        {
            GameObject labelObject = new($"{value}_Label");
            labelObject.transform.SetParent(parent);
            labelObject.transform.SetPositionAndRotation(
                position + Vector3.up * 0.34f,
                Quaternion.Euler(90f, 0f, 0f));
            TextMesh label = labelObject.AddComponent<TextMesh>();
            label.font = GetRuntimeFont();
            label.text = value;
            label.fontSize = 54;
            label.characterSize = 0.18f;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.color = Color.white;
            MeshRenderer labelRenderer = labelObject.GetComponent<MeshRenderer>();
            if (labelRenderer != null && label.font != null)
            {
                labelRenderer.sharedMaterial = label.font.material;
                labelRenderer.shadowCastingMode = ShadowCastingMode.Off;
                labelRenderer.receiveShadows = false;
            }
        }

        private static Transform CreateGhostVisual(Transform parent)
        {
            Transform ghost = new GameObject("MyBestGhost").transform;
            ghost.SetParent(parent);
            BlueRallyVisualInstance visual = BlueRallyCarVisual.Create(ghost, true, MiniRcScale);
            RcWheelVisualAnimator wheelAnimator = ghost.gameObject.AddComponent<RcWheelVisualAnimator>();
            wheelAnimator.ConfigureGhost(ghost, visual, MiniRcScale);
            return ghost;
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
            RaceSession raceSession,
            GhostPlayback ghostPlayback,
            ReplayRecorder replayRecorder,
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
                new Vector2(0f, 1f), new Vector2(0f, 1f), "MODE: ARROW",
                out Button button, out Text modeLabel);

            GameObject restartButton = CreateClickButton(
                "RestartButton", safeArea, new Vector2(-44f, -44f), new Vector2(250f, 72f),
                new Vector2(1f, 1f), new Vector2(1f, 1f), "RESTART [R]",
                out Button restart, out _);
            restart.onClick.AddListener(raceSession.RestartRace);

            Text hudText = CreateText("Telemetry", safeArea, string.Empty, 30, TextAnchor.UpperCenter);
            RectTransform hudRect = hudText.rectTransform;
            hudRect.anchorMin = new Vector2(0.5f, 1f);
            hudRect.anchorMax = new Vector2(0.5f, 1f);
            hudRect.pivot = new Vector2(0.5f, 1f);
            hudRect.anchoredPosition = new Vector2(0f, -36f);
            hudRect.sizeDelta = new Vector2(980f, 170f);
            Outline outline = hudText.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(0f, 0f, 0f, 0.8f);
            outline.effectDistance = new Vector2(2f, -2f);

            Text raceBanner = CreateText("RaceBanner", safeArea, string.Empty, 92, TextAnchor.MiddleCenter);
            RectTransform bannerRect = raceBanner.rectTransform;
            bannerRect.anchorMin = new Vector2(0.5f, 0.5f);
            bannerRect.anchorMax = new Vector2(0.5f, 0.5f);
            bannerRect.pivot = new Vector2(0.5f, 0.5f);
            bannerRect.anchoredPosition = new Vector2(0f, 80f);
            bannerRect.sizeDelta = new Vector2(1000f, 210f);
            Outline bannerOutline = raceBanner.gameObject.AddComponent<Outline>();
            bannerOutline.effectColor = new Color(0f, 0f, 0f, 0.92f);
            bannerOutline.effectDistance = new Vector2(3f, -3f);

            Text leaderboard = CreateText("LocalLeaderboard", safeArea, string.Empty, 24, TextAnchor.UpperRight);
            RectTransform leaderboardRect = leaderboard.rectTransform;
            leaderboardRect.anchorMin = new Vector2(1f, 1f);
            leaderboardRect.anchorMax = new Vector2(1f, 1f);
            leaderboardRect.pivot = new Vector2(1f, 1f);
            leaderboardRect.anchoredPosition = new Vector2(-44f, -132f);
            leaderboardRect.sizeDelta = new Vector2(360f, 250f);
            Outline leaderboardOutline = leaderboard.gameObject.AddComponent<Outline>();
            leaderboardOutline.effectColor = new Color(0f, 0f, 0f, 0.8f);
            leaderboardOutline.effectDistance = new Vector2(2f, -2f);

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
            hud.Configure(
                hudText,
                raceBanner,
                leaderboard,
                telemetry,
                modeController,
                raceSession,
                ghostPlayback,
                replayRecorder);

            inputRouter.RefreshSources();
            _ = modeButton;
            _ = restartButton;
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
            string initialLabel,
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
            label = CreateText("Label", rect, initialLabel, 28, TextAnchor.MiddleCenter);
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
            text.raycastTarget = false;
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
            if (color.a < 0.999f && material.HasProperty("_Mode"))
            {
                material.SetFloat("_Mode", 3f);
                material.SetOverrideTag("RenderType", "Transparent");
                material.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
                material.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                material.SetInt("_ZWrite", 0);
                material.DisableKeyword("_ALPHATEST_ON");
                material.EnableKeyword("_ALPHABLEND_ON");
                material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                material.renderQueue = (int)RenderQueue.Transparent;
                renderer.shadowCastingMode = ShadowCastingMode.Off;
                renderer.receiveShadows = false;
            }
            renderer.sharedMaterial = material;
        }

        private readonly struct CarRuntime
        {
            public GameObject Root { get; }
            public CubeCarController Controller { get; }
            public VehicleInputRouter InputRouter { get; }
            public TouchVehicleInputSource TouchInput { get; }
            public VehicleTelemetry Telemetry { get; }
            public Transform CameraTarget { get; }

            public CarRuntime(
                GameObject root,
                CubeCarController controller,
                VehicleInputRouter inputRouter,
                TouchVehicleInputSource touchInput,
                VehicleTelemetry telemetry,
                Transform cameraTarget)
            {
                Root = root;
                Controller = controller;
                InputRouter = inputRouter;
                TouchInput = touchInput;
                Telemetry = telemetry;
                CameraTarget = cameraTarget;
            }
        }
    }
}
