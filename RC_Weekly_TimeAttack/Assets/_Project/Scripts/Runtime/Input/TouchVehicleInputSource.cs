using UnityEngine;

namespace RCWeeklyTimeAttack.Input
{
    public sealed class TouchVehicleInputSource : VehicleInputSource
    {
        private SteeringInputBehaviour steeringInput;
        private bool throttlePressed;
        private bool brakePressed;

        public void SetSteeringInput(SteeringInputBehaviour value)
        {
            steeringInput?.ResetInput();
            steeringInput = value;
        }

        public void SetThrottlePressed(bool value)
        {
            throttlePressed = value;
        }

        public void SetBrakePressed(bool value)
        {
            brakePressed = value;
        }

        public override VehicleInputFrame ReadInput()
        {
            float steering = steeringInput != null ? steeringInput.Value : 0f;
            return new VehicleInputFrame(
                steering,
                throttlePressed ? 1f : 0f,
                brakePressed ? 1f : 0f);
        }

        public override void ResetInput()
        {
            throttlePressed = false;
            brakePressed = false;
            steeringInput?.ResetInput();
        }

        private void OnDisable()
        {
            ResetInput();
        }
    }
}

