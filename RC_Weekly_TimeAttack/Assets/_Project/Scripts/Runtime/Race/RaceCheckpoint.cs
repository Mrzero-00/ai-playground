using UnityEngine;

namespace RCWeeklyTimeAttack.Race
{
    [RequireComponent(typeof(BoxCollider))]
    public sealed class RaceCheckpoint : MonoBehaviour
    {
        [SerializeField, Min(0)] private int gateIndex;
        [SerializeField] private Vector3 expectedDirection = Vector3.forward;

        public int GateIndex => gateIndex;

        public void Configure(int index, Vector3 validDirection)
        {
            gateIndex = Mathf.Max(0, index);
            expectedDirection = validDirection.sqrMagnitude > 0.001f
                ? validDirection.normalized
                : Vector3.forward;
            BoxCollider trigger = GetComponent<BoxCollider>();
            trigger.isTrigger = true;
        }

        private void OnTriggerEnter(Collider other)
        {
            Rigidbody attachedBody = other.attachedRigidbody;
            if (attachedBody == null || !IsDirectionValid(expectedDirection, attachedBody.linearVelocity))
            {
                return;
            }

            RaceSession session = attachedBody.GetComponent<RaceSession>();
            session?.PassGate(gateIndex);
        }

        public static bool IsDirectionValid(Vector3 expected, Vector3 velocity)
        {
            Vector3 planarVelocity = Vector3.ProjectOnPlane(velocity, Vector3.up);
            return planarVelocity.sqrMagnitude > 0.01f &&
                   Vector3.Dot(expected.normalized, planarVelocity.normalized) > 0.1f;
        }
    }
}
