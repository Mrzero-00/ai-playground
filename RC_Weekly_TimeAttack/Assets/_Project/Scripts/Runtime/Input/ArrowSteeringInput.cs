using UnityEngine;

namespace RCWeeklyTimeAttack.Input
{
    public sealed class ArrowSteeringInput : SteeringInputBehaviour
    {
        [SerializeField, Min(0.1f)] private float riseSpeed = 4.5f;
        [SerializeField, Min(0.1f)] private float returnSpeed = 6.5f;

        private bool leftPressed;
        private bool rightPressed;
        private float currentValue;

        public override float Value => currentValue;

        public void SetLeftPressed(bool value)
        {
            leftPressed = value;
        }

        public void SetRightPressed(bool value)
        {
            rightPressed = value;
        }

        private void Update()
        {
            float target = (rightPressed ? 1f : 0f) - (leftPressed ? 1f : 0f);
            float speed = Mathf.Approximately(target, 0f) ? returnSpeed : riseSpeed;
            currentValue = Mathf.MoveTowards(currentValue, target, speed * Time.unscaledDeltaTime);
        }

        public override void ResetInput()
        {
            leftPressed = false;
            rightPressed = false;
            currentValue = 0f;
        }

        private void OnDisable()
        {
            ResetInput();
        }
    }
}

