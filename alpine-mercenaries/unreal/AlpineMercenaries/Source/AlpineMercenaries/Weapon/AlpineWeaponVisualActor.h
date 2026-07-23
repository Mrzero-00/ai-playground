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

	virtual void Tick(float DeltaSeconds) override;

	void ConfigureForWeapon(EAlpineWeaponType WeaponType, bool bOffhand);
	void PlayPrimaryComboMotion(
		EAlpineWeaponType WeaponType,
		int32 ComboStep,
		float Duration);

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

	FTransform RestRelativeTransform;
	FTransform MotionStartTransform;
	FTransform MotionEndTransform;
	float MotionElapsed = 0.0f;
	float MotionDuration = 0.25f;
	bool bMotionActive = false;

	void ResetParts();
	void ConfigurePart(
		UStaticMeshComponent* Part,
		UStaticMesh* Mesh,
		const FVector& Location,
		const FRotator& Rotation,
		const FVector& Scale,
		const FLinearColor& Color);
};
