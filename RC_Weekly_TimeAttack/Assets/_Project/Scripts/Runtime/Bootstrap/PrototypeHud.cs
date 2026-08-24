using RCWeeklyTimeAttack.Input;
using RCWeeklyTimeAttack.Vehicle;
using UnityEngine;
using UnityEngine.UI;

namespace RCWeeklyTimeAttack.Bootstrap
{
    public sealed class PrototypeHud : MonoBehaviour
    {
        [SerializeField] private Text output;
        [SerializeField] private VehicleTelemetry telemetry;
        [SerializeField] private SteeringModeController steeringMode;

        public void Configure(
            Text targetOutput,
            VehicleTelemetry targetTelemetry,
            SteeringModeController modeController)
        {
            output = targetOutput;
            telemetry = targetTelemetry;
            steeringMode = modeController;
        }

        private void Update()
        {
            if (output == null || telemetry == null)
            {
                return;
            }

            VehicleTelemetrySnapshot snapshot = telemetry.Snapshot;
            string mode = steeringMode != null ? steeringMode.CurrentMode.ToString().ToUpperInvariant() : "UNKNOWN";
            output.text =
                $"V0.1  |  {snapshot.ForwardSpeed * 3.6f:0} km/h  |  {mode}\n" +
                $"STEER {snapshot.Steering:+0.00;-0.00;0.00}   GAS {snapshot.Throttle:0.00}   BRAKE {snapshot.Brake:0.00}";
        }
    }
}

