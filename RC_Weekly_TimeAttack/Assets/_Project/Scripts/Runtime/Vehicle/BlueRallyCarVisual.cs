using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace RCWeeklyTimeAttack.Vehicle
{
    internal readonly struct BlueRallyVisualInstance
    {
        public Transform Root { get; }
        public Transform FrontLeftWheel { get; }
        public Transform FrontRightWheel { get; }
        public Transform RearLeftWheel { get; }
        public Transform RearRightWheel { get; }

        public BlueRallyVisualInstance(
            Transform root,
            Transform frontLeftWheel,
            Transform frontRightWheel,
            Transform rearLeftWheel,
            Transform rearRightWheel)
        {
            Root = root;
            FrontLeftWheel = frontLeftWheel;
            FrontRightWheel = frontRightWheel;
            RearLeftWheel = rearLeftWheel;
            RearRightWheel = rearRightWheel;
        }
    }

    internal static class BlueRallyCarVisual
    {
        private const string ResourcePath = "Vehicles/BlueRallyRC";
        private static readonly Color BodyBlue = new(0.025f, 0.34f, 0.98f);
        private static readonly Color Graphite = new(0.018f, 0.026f, 0.045f);
        private static readonly Color SmokedGlass = new(0.015f, 0.028f, 0.052f);
        private static readonly Color YellowAccent = new(1f, 0.66f, 0.04f);
        private static readonly Color TailRed = new(0.95f, 0.025f, 0.018f);
        private static readonly Color LampWhite = new(0.78f, 0.94f, 1f);
        private static readonly Color GhostCyan = new(0.12f, 0.94f, 1f, 0.32f);

        public static BlueRallyVisualInstance Create(Transform parent, bool ghost, float scale)
        {
            GameObject source = Resources.Load<GameObject>(ResourcePath);
            GameObject instance = source != null
                ? Object.Instantiate(source, parent, false)
                : CreateFallback(parent);

            instance.name = ghost ? "BlueRallyRC_Ghost" : "BlueRallyRC_Visual";
            instance.transform.localPosition = Vector3.zero;
            instance.transform.localRotation = Quaternion.identity;
            instance.transform.localScale = Vector3.one * scale;

            DisableImportedColliders(instance);
            ApplyRuntimeMaterials(instance, ghost);

            return new BlueRallyVisualInstance(
                instance.transform,
                FindDescendant(instance.transform, "Wheel_FL"),
                FindDescendant(instance.transform, "Wheel_FR"),
                FindDescendant(instance.transform, "Wheel_RL"),
                FindDescendant(instance.transform, "Wheel_RR"));
        }

        private static void ApplyRuntimeMaterials(GameObject instance, bool ghost)
        {
            Dictionary<Material, Material> materialCopies = new();
            Renderer[] renderers = instance.GetComponentsInChildren<Renderer>(true);
            foreach (Renderer renderer in renderers)
            {
                Material[] sourceMaterials = renderer.sharedMaterials;
                Material[] runtimeMaterials = new Material[sourceMaterials.Length];
                for (int index = 0; index < sourceMaterials.Length; index++)
                {
                    Material source = sourceMaterials[index];
                    if (source == null)
                    {
                        runtimeMaterials[index] = null;
                        continue;
                    }

                    if (!materialCopies.TryGetValue(source, out Material runtimeMaterial))
                    {
                        runtimeMaterial = new Material(source)
                        {
                            name = ghost ? $"{source.name}_Ghost" : $"{source.name}_Runtime",
                            hideFlags = HideFlags.DontSave
                        };
                        Color targetColor = ghost ? GhostCyan : ResolvePlayerColor(source);
                        SetMaterialColor(runtimeMaterial, targetColor);
                        if (ghost)
                        {
                            ConfigureTransparent(runtimeMaterial);
                        }
                        materialCopies.Add(source, runtimeMaterial);
                    }
                    runtimeMaterials[index] = runtimeMaterial;
                }

                renderer.sharedMaterials = runtimeMaterials;
                if (ghost)
                {
                    renderer.shadowCastingMode = ShadowCastingMode.Off;
                    renderer.receiveShadows = false;
                }
            }
        }

        private static Color ResolvePlayerColor(Material source)
        {
            string materialName = source.name;
            if (materialName.Contains("BlueBody"))
            {
                return BodyBlue;
            }
            if (materialName.Contains("SmokedGlass"))
            {
                return SmokedGlass;
            }
            if (materialName.Contains("YellowAccent"))
            {
                return YellowAccent;
            }
            if (materialName.Contains("LampWhite"))
            {
                return LampWhite;
            }
            if (materialName.Contains("TailRed"))
            {
                return TailRed;
            }
            if (materialName.Contains("Graphite"))
            {
                return Graphite;
            }
            if (source.HasProperty("_BaseColor"))
            {
                return source.GetColor("_BaseColor");
            }
            if (source.HasProperty("_Color"))
            {
                return source.GetColor("_Color");
            }
            return Color.white;
        }

        private static void SetMaterialColor(Material material, Color color)
        {
            if (material.HasProperty("_BaseColor"))
            {
                material.SetColor("_BaseColor", color);
            }
            if (material.HasProperty("_Color"))
            {
                material.SetColor("_Color", color);
            }
        }

        private static void ConfigureTransparent(Material material)
        {
            if (material.HasProperty("_Surface"))
            {
                material.SetFloat("_Surface", 1f);
                material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            }
            if (material.HasProperty("_Mode"))
            {
                material.SetFloat("_Mode", 3f);
            }
            if (material.HasProperty("_SrcBlend"))
            {
                material.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
            }
            if (material.HasProperty("_DstBlend"))
            {
                material.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            }
            if (material.HasProperty("_ZWrite"))
            {
                material.SetInt("_ZWrite", 0);
            }
            material.SetOverrideTag("RenderType", "Transparent");
            material.DisableKeyword("_ALPHATEST_ON");
            material.EnableKeyword("_ALPHABLEND_ON");
            material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            material.renderQueue = (int)RenderQueue.Transparent;
        }

        private static void DisableImportedColliders(GameObject instance)
        {
            foreach (Collider collider in instance.GetComponentsInChildren<Collider>(true))
            {
                collider.enabled = false;
                Object.Destroy(collider);
            }
        }

        private static Transform FindDescendant(Transform root, string objectName)
        {
            foreach (Transform descendant in root.GetComponentsInChildren<Transform>(true))
            {
                if (descendant.name == objectName)
                {
                    return descendant;
                }
            }
            return null;
        }

        private static GameObject CreateFallback(Transform parent)
        {
            GameObject root = new("BlueRallyRC_Fallback");
            root.transform.SetParent(parent, false);
            CreatePrimitive(PrimitiveType.Capsule, root.transform, "BodyShell",
                new Vector3(0f, 0.34f, 0f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.78f, 0.9f, 0.34f), BodyBlue);
            CreatePrimitive(PrimitiveType.Sphere, root.transform, "Canopy",
                new Vector3(0f, 0.61f, -0.04f), Quaternion.identity,
                new Vector3(0.54f, 0.31f, 0.69f), SmokedGlass);
            CreatePrimitive(PrimitiveType.Cube, root.transform, "RearWing",
                new Vector3(0f, 0.86f, -0.94f), Quaternion.identity,
                new Vector3(1.3f, 0.09f, 0.25f), Graphite);
            CreateFallbackWheel(root.transform, "Wheel_FL", new Vector3(-0.91f, 0.12f, 0.72f));
            CreateFallbackWheel(root.transform, "Wheel_FR", new Vector3(0.91f, 0.12f, 0.72f));
            CreateFallbackWheel(root.transform, "Wheel_RL", new Vector3(-0.91f, 0.12f, -0.7f));
            CreateFallbackWheel(root.transform, "Wheel_RR", new Vector3(0.91f, 0.12f, -0.7f));
            return root;
        }

        private static void CreateFallbackWheel(Transform parent, string objectName, Vector3 localPosition)
        {
            CreatePrimitive(PrimitiveType.Cylinder, parent, objectName,
                localPosition, Quaternion.Euler(0f, 0f, 90f),
                new Vector3(0.78f, 0.17f, 0.78f), Graphite);
        }

        private static void CreatePrimitive(
            PrimitiveType primitiveType,
            Transform parent,
            string objectName,
            Vector3 localPosition,
            Quaternion localRotation,
            Vector3 localScale,
            Color color)
        {
            GameObject primitive = GameObject.CreatePrimitive(primitiveType);
            primitive.name = objectName;
            primitive.transform.SetParent(parent, false);
            primitive.transform.localPosition = localPosition;
            primitive.transform.localRotation = localRotation;
            primitive.transform.localScale = localScale;
            Collider collider = primitive.GetComponent<Collider>();
            collider.enabled = false;
            Object.Destroy(collider);
            Material material = primitive.GetComponent<Renderer>().material;
            SetMaterialColor(material, color);
        }
    }
}
