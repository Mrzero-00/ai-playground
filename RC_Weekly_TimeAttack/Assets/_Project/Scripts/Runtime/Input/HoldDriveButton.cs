using UnityEngine;
using UnityEngine.EventSystems;

namespace RCWeeklyTimeAttack.Input
{
    public enum DriveButtonAction
    {
        Gas,
        Brake,
        ArrowLeft,
        ArrowRight
    }

    public sealed class HoldDriveButton : MonoBehaviour,
        IPointerDownHandler,
        IPointerUpHandler,
        IPointerExitHandler,
        ICancelHandler
    {
        [SerializeField] private DriveButtonAction action;
        [SerializeField] private TouchVehicleInputSource touchInput;
        [SerializeField] private ArrowSteeringInput arrowInput;

        private bool isPressed;

        public void Configure(
            DriveButtonAction buttonAction,
            TouchVehicleInputSource touchSource,
            ArrowSteeringInput arrowSource)
        {
            action = buttonAction;
            touchInput = touchSource;
            arrowInput = arrowSource;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            isPressed = true;
            Apply(true);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            Release();
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            Release();
        }

        public void OnCancel(BaseEventData eventData)
        {
            Release();
        }

        private void Apply(bool value)
        {
            switch (action)
            {
                case DriveButtonAction.Gas:
                    touchInput?.SetThrottlePressed(value);
                    break;
                case DriveButtonAction.Brake:
                    touchInput?.SetBrakePressed(value);
                    break;
                case DriveButtonAction.ArrowLeft:
                    arrowInput?.SetLeftPressed(value);
                    break;
                case DriveButtonAction.ArrowRight:
                    arrowInput?.SetRightPressed(value);
                    break;
            }
        }

        private void Release()
        {
            if (!isPressed)
            {
                return;
            }

            isPressed = false;
            Apply(false);
        }

        private void OnDisable()
        {
            Release();
        }
    }
}

