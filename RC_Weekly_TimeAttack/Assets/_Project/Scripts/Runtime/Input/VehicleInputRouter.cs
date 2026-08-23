using System;
using UnityEngine;

namespace RCWeeklyTimeAttack.Input
{
    [DefaultExecutionOrder(-200)]
    public sealed class VehicleInputRouter : MonoBehaviour
    {
        [SerializeField] private VehicleInputSource[] sources = Array.Empty<VehicleInputSource>();

        public VehicleInputFrame Current { get; private set; } = VehicleInputFrame.Neutral;

        private void Awake()
        {
            RefreshSources();
        }

        private void Update()
        {
            Current = ComposeCurrentFrame();
        }

        public void RefreshSources()
        {
            sources = GetComponents<VehicleInputSource>();
        }

        public VehicleInputFrame ComposeCurrentFrame()
        {
            float steering = 0f;
            float throttle = 0f;
            float brake = 0f;

            foreach (VehicleInputSource source in sources)
            {
                if (source == null || !source.isActiveAndEnabled)
                {
                    continue;
                }

                VehicleInputFrame frame = source.ReadInput();
                if (Mathf.Abs(frame.Steering) >= Mathf.Abs(steering))
                {
                    steering = frame.Steering;
                }

                throttle = Mathf.Max(throttle, frame.Throttle);
                brake = Mathf.Max(brake, frame.Brake);
            }

            return new VehicleInputFrame(steering, throttle, brake);
        }

        public void ResetAllInput()
        {
            foreach (VehicleInputSource source in sources)
            {
                source?.ResetInput();
            }

            Current = VehicleInputFrame.Neutral;
        }

        private void OnApplicationFocus(bool hasFocus)
        {
            if (!hasFocus)
            {
                ResetAllInput();
            }
        }

        private void OnApplicationPause(bool isPaused)
        {
            if (isPaused)
            {
                ResetAllInput();
            }
        }

        private void OnDisable()
        {
            ResetAllInput();
        }
    }
}

