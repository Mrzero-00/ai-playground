using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;

namespace RCWeeklyTimeAttack.Tests
{
    public sealed class BlueRallyModelTests
    {
        private const string ResourcePath = "Vehicles/BlueRallyRC";

        [Test]
        public void Fbx_KeepsTriangleAndMaterialBudget()
        {
            GameObject prefab = Resources.Load<GameObject>(ResourcePath);

            Assert.That(prefab, Is.Not.Null, $"Missing Resources/{ResourcePath}.fbx");
            int triangleCount = 0;
            HashSet<string> materialNames = new();
            foreach (MeshFilter filter in prefab.GetComponentsInChildren<MeshFilter>(true))
            {
                if (filter.sharedMesh != null)
                {
                    triangleCount += filter.sharedMesh.triangles.Length / 3;
                }
            }
            foreach (Renderer renderer in prefab.GetComponentsInChildren<Renderer>(true))
            {
                foreach (Material material in renderer.sharedMaterials)
                {
                    if (material != null)
                    {
                        materialNames.Add(material.name);
                    }
                }
            }

            Assert.That(triangleCount, Is.InRange(8000, 15000));
            Assert.That(materialNames.Count, Is.InRange(4, 6));
        }

        [Test]
        public void Fbx_ExposesFourIndependentWheelObjects()
        {
            GameObject prefab = Resources.Load<GameObject>(ResourcePath);

            Assert.That(prefab, Is.Not.Null, $"Missing Resources/{ResourcePath}.fbx");
            Assert.That(FindDescendant(prefab.transform, "Wheel_FL"), Is.Not.Null);
            Assert.That(FindDescendant(prefab.transform, "Wheel_FR"), Is.Not.Null);
            Assert.That(FindDescendant(prefab.transform, "Wheel_RL"), Is.Not.Null);
            Assert.That(FindDescendant(prefab.transform, "Wheel_RR"), Is.Not.Null);
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
    }
}
