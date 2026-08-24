using UnityEngine;
using UnityEngine.UI;

namespace RCWeeklyTimeAttack.Input
{
    public enum SteeringMode
    {
        Arrow,
        Wheel
    }

    public sealed class SteeringModeController : MonoBehaviour
    {
        [SerializeField] private SteeringMode currentMode = SteeringMode.Arrow;
        [SerializeField] private GameObject arrowGroup;
        [SerializeField] private GameObject wheelGroup;
        [SerializeField] private ArrowSteeringInput arrowInput;
        [SerializeField] private VirtualSteeringWheelInput wheelInput;
        [SerializeField] private TouchVehicleInputSource touchInput;
        [SerializeField] private Text modeLabel;

        public SteeringMode CurrentMode => currentMode;

        public void Configure(
            GameObject arrowControls,
            GameObject wheelControls,
            ArrowSteeringInput arrow,
            VirtualSteeringWheelInput wheel,
            TouchVehicleInputSource touch,
            Text label,
            SteeringMode initialMode)
        {
            arrowGroup = arrowControls;
            wheelGroup = wheelControls;
            arrowInput = arrow;
            wheelInput = wheel;
            touchInput = touch;
            modeLabel = label;
            SetMode(initialMode);
        }

        public void Toggle()
        {
            SetMode(currentMode == SteeringMode.Arrow ? SteeringMode.Wheel : SteeringMode.Arrow);
        }

        public void SetMode(SteeringMode mode)
        {
            arrowInput?.ResetInput();
            wheelInput?.ResetInput();
            currentMode = mode;

            bool useArrow = currentMode == SteeringMode.Arrow;
            arrowGroup?.SetActive(useArrow);
            wheelGroup?.SetActive(!useArrow);
            touchInput?.SetSteeringInput(
                useArrow ? (SteeringInputBehaviour)arrowInput : wheelInput);

            if (modeLabel != null)
            {
                modeLabel.text = useArrow ? "MODE: ARROW" : "MODE: WHEEL";
            }
        }
    }
}
