using UnityEngine;
using UnityEngine.EventSystems;

namespace RCWeeklyTimeAttack.Input
{
    [RequireComponent(typeof(RectTransform))]
    public sealed class VirtualSteeringWheelInput : SteeringInputBehaviour,
        IPointerDownHandler,
        IDragHandler,
        IPointerUpHandler,
        IEndDragHandler,
        ICancelHandler
    {
        [SerializeField, Range(45f, 180f)] private float maxRotation = 90f;
        [SerializeField, Range(0f, 0.5f)] private float deadZone = 0.06f;
        [SerializeField, Min(10f)] private float returnDegreesPerSecond = 260f;
        [SerializeField] private RectTransform wheelVisual;

        private RectTransform wheelRect;
        private int activePointerId = int.MinValue;
        private bool isDragging;
        private float lastPointerAngle;
        private float wheelAngle;

        public override float Value => SteeringWheelMath.ToNormalizedSteering(wheelAngle, maxRotation, deadZone);

        public void Configure(RectTransform visual)
        {
            wheelRect = (RectTransform)transform;
            wheelVisual = visual != null ? visual : wheelRect;
            ApplyVisualRotation();
        }

        private void Awake()
        {
            wheelRect = (RectTransform)transform;
            if (wheelVisual == null)
            {
                wheelVisual = wheelRect;
            }
        }

        private void Update()
        {
            if (!isDragging)
            {
                wheelAngle = Mathf.MoveTowards(
                    wheelAngle,
                    0f,
                    returnDegreesPerSecond * Time.unscaledDeltaTime);
                ApplyVisualRotation();
            }
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (isDragging || !TryGetPointerAngle(eventData, out float pointerAngle))
            {
                return;
            }

            activePointerId = eventData.pointerId;
            isDragging = true;
            lastPointerAngle = pointerAngle;
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (!isDragging || eventData.pointerId != activePointerId ||
                !TryGetPointerAngle(eventData, out float pointerAngle))
            {
                return;
            }

            wheelAngle = SteeringWheelMath.AccumulateDelta(
                wheelAngle,
                lastPointerAngle,
                pointerAngle,
                maxRotation);
            lastPointerAngle = pointerAngle;
            ApplyVisualRotation();
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            ReleasePointer(eventData.pointerId);
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            ReleasePointer(eventData.pointerId);
        }

        public void OnCancel(BaseEventData eventData)
        {
            ResetInput();
        }

        public override void ResetInput()
        {
            activePointerId = int.MinValue;
            isDragging = false;
            lastPointerAngle = 0f;
            wheelAngle = 0f;
            ApplyVisualRotation();
        }

        private bool TryGetPointerAngle(PointerEventData eventData, out float angle)
        {
            bool found = RectTransformUtility.ScreenPointToLocalPointInRectangle(
                wheelRect,
                eventData.position,
                eventData.pressEventCamera,
                out Vector2 localPoint);
            angle = found ? SteeringWheelMath.PointerAngle(localPoint) : 0f;
            return found && localPoint.sqrMagnitude > 64f;
        }

        private void ReleasePointer(int pointerId)
        {
            if (pointerId != activePointerId)
            {
                return;
            }

            activePointerId = int.MinValue;
            isDragging = false;
        }

        private void ApplyVisualRotation()
        {
            if (wheelVisual != null)
            {
                wheelVisual.localRotation = Quaternion.Euler(0f, 0f, wheelAngle);
            }
        }

        private void OnDisable()
        {
            ResetInput();
        }
    }
}
