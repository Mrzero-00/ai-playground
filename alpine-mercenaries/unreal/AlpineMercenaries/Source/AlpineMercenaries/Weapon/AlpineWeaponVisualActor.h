#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Weapon/AlpineWeaponTypes.h"
#include "AlpineWeaponVisualActor.generated.h"

class UMaterialInterface;
class UStaticMesh;
class UStaticMeshComponent;

UCLASS(NotBlueprintable)
class ALPINEMERCENARIES_API AAlpineWeaponVisualActor : public AActor
{
	GENERATED_BODY()

public:
	AAlpineWeaponVisualActor();

	void ConfigureForWeapon(EAlpineWeaponType WeaponType, bool bOffhand);

private:
	UPROPERTY(VisibleAnywhere, Category = "Alpine|Weapon")
	TObjectPtr<USceneComponent> VisualRoot;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Weapon")
	TObjectPtr<UStaticMeshComponent> PartA;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Weapon")
	TObjectPtr<UStaticMeshComponent> PartB;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Weapon")
	TObjectPtr<UStaticMeshComponent> PartC;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Weapon")
	TObjectPtr<UStaticMeshComponent> PartD;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CubeMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CylinderMesh;

	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;

	void ResetParts();
	void ConfigurePart(
		UStaticMeshComponent* Part,
		UStaticMesh* Mesh,
		const FVector& Location,
		const FRotator& Rotation,
		const FVector& Scale,
		const FLinearColor& Color);
};
