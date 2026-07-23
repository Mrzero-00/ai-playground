#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AlpineTrainingTarget.generated.h"

class UCapsuleComponent;
class UMaterialInstanceDynamic;
class UMaterialInterface;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;
class UAlpineTargetHealthComponent;

UCLASS()
class ALPINEMERCENARIES_API AAlpineTrainingTarget : public AActor
{
	GENERATED_BODY()

public:
	AAlpineTrainingTarget();

	virtual float TakeDamage(
		float DamageAmount,
		const FDamageEvent& DamageEvent,
		AController* EventInstigator,
		AActor* DamageCauser) override;

	UFUNCTION(BlueprintPure, Category = "Alpine|Training Target")
	UAlpineTargetHealthComponent* GetHealthComponent() const
	{
		return HealthComponent;
	}

	UFUNCTION(BlueprintPure, Category = "Alpine|Training Target")
	float GetResetDelay() const { return ResetDelay; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Training Target")
	float GetCollisionHalfHeight() const;

	UFUNCTION(BlueprintPure, Category = "Alpine|Training Target")
	UCapsuleComponent* GetCollisionComponent() const { return CollisionRoot; }

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY(
		VisibleAnywhere,
		BlueprintReadOnly,
		Category = "Alpine|Training Target",
		meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UCapsuleComponent> CollisionRoot;

	UPROPERTY(
		VisibleAnywhere,
		BlueprintReadOnly,
		Category = "Alpine|Training Target",
		meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UAlpineTargetHealthComponent> HealthComponent;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Training Target")
	TObjectPtr<UStaticMeshComponent> BaseMesh;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Training Target")
	TObjectPtr<UStaticMeshComponent> TorsoMesh;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Training Target")
	TObjectPtr<UStaticMeshComponent> HeadMesh;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Training Target")
	TObjectPtr<UStaticMeshComponent> CrossbarMesh;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Training Target")
	TObjectPtr<UStaticMeshComponent> HealthBarBackground;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Training Target")
	TObjectPtr<UStaticMeshComponent> HealthBarFill;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Training Target")
	TObjectPtr<UTextRenderComponent> HealthText;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CubeMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CylinderMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> SphereMesh;

	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> TorsoMaterial;

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> HealthBarMaterial;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Training Target",
		meta = (ClampMin = "0.1"))
	float ResetDelay = 4.0f;

	FTimerHandle ResetTimer;

	UFUNCTION()
	void HandleHealthChanged();

	void ResetTarget();
	void UpdateDisplay();
	void ConfigureVisualPart(
		UStaticMeshComponent* Part,
		UStaticMesh* Mesh,
		const FVector& Location,
		const FRotator& Rotation,
		const FVector& Scale);
};
