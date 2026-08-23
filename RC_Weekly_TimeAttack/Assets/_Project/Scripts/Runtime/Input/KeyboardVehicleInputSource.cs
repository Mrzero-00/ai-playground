using UnityEngine;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace RCWeeklyTimeAttack.Input
{
    public sealed class KeyboardVehicleInputSource : VehicleInputSource
    {
        public override VehicleInputFrame ReadInput()
        {
#if ENABLE_INPUT_SYSTEM
            Keyboard keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return VehicleInputFrame.Neutral;
            }

            bool left = keyboard.leftArrowKey.isPressed || keyboard.aKey.isPressed;
            bool right = keyboard.rightArrowKey.isPressed || keyboard.dKey.isPressed;
            bool gas = keyboard.upArrowKey.isPressed || keyboard.wKey.isPressed;
            bool brake = keyboard.downArrowKey.isPressed || keyboard.sKey.isPressed;
#else
            bool left = UnityEngine.Input.GetKey(KeyCode.LeftArrow) || UnityEngine.Input.GetKey(KeyCode.A);
            bool right = UnityEngine.Input.GetKey(KeyCode.RightArrow) || UnityEngine.Input.GetKey(KeyCode.D);
            bool gas = UnityEngine.Input.GetKey(KeyCode.UpArrow) || UnityEngine.Input.GetKey(KeyCode.W);
            bool brake = UnityEngine.Input.GetKey(KeyCode.DownArrow) || UnityEngine.Input.GetKey(KeyCode.S);
#endif

            float steering = (right ? 1f : 0f) - (left ? 1f : 0f);
            return new VehicleInputFrame(steering, gas ? 1f : 0f, brake ? 1f : 0f);
        }

        public override void ResetInput()
        {
            // Keyboard state is owned by Unity and has no retained local state.
        }
    }
}

