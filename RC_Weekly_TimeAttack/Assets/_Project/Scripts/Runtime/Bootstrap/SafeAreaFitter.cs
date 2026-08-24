using UnityEngine;

namespace RCWeeklyTimeAttack.Bootstrap
{
    [ExecuteAlways]
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeAreaFitter : MonoBehaviour
    {
        private RectTransform target;
        private Rect lastSafeArea;
        private Vector2Int lastScreenSize;

        private void Awake()
        {
            target = (RectTransform)transform;
            ApplySafeArea();
        }

        private void Update()
        {
            if (lastSafeArea != Screen.safeArea ||
                lastScreenSize.x != Screen.width ||
                lastScreenSize.y != Screen.height)
            {
                ApplySafeArea();
            }
        }

        private void ApplySafeArea()
        {
            if (target == null)
            {
                target = (RectTransform)transform;
            }

            Rect safeArea = Screen.safeArea;
            float width = Mathf.Max(1f, Screen.width);
            float height = Mathf.Max(1f, Screen.height);

            target.anchorMin = new Vector2(safeArea.xMin / width, safeArea.yMin / height);
            target.anchorMax = new Vector2(safeArea.xMax / width, safeArea.yMax / height);
            target.offsetMin = Vector2.zero;
            target.offsetMax = Vector2.zero;

            lastSafeArea = safeArea;
            lastScreenSize = new Vector2Int(Screen.width, Screen.height);
        }
    }
}

