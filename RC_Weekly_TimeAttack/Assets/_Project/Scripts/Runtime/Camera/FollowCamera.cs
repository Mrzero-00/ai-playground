using UnityEngine;

namespace RCWeeklyTimeAttack.CameraSystem
{
    [RequireComponent(typeof(Camera))]
    public sealed class FollowCamera : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 localOffset = new(0f, 10f, -12f);
        [SerializeField, Min(0.01f)] private float positionSmoothTime = 0.18f;
        [SerializeField, Min(0f)] private float rotationSharpness = 9f;
        [SerializeField, Min(0f)] private float lookAheadDistance = 2.5f;

        private Vector3 positionVelocity;

        public void Configure(Transform followTarget)
        {
            target = followTarget;
            SnapToTarget();
        }

        private void LateUpdate()
        {
            if (target == null)
            {
                return;
            }

            Vector3 desiredPosition = target.TransformPoint(localOffset);
            transform.position = Vector3.SmoothDamp(
                transform.position,
                desiredPosition,
                ref positionVelocity,
                positionSmoothTime);

            Vector3 lookPoint = target.position + target.forward * lookAheadDistance;
            Quaternion desiredRotation = Quaternion.LookRotation(lookPoint - transform.position, Vector3.up);
            float blend = 1f - Mathf.Exp(-rotationSharpness * Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, blend);
        }

        private void SnapToTarget()
        {
            if (target == null)
            {
                return;
            }

            positionVelocity = Vector3.zero;
            transform.position = target.TransformPoint(localOffset);
            Vector3 lookPoint = target.position + target.forward * lookAheadDistance;
            transform.rotation = Quaternion.LookRotation(lookPoint - transform.position, Vector3.up);
        }
    }
}

