#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AlpineProjectileLauncher.generated.h"

class AAlpineTestProjectile;
class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

UCLASS()
class ALPINEMERCENARIES_API AAlpineProjectileLauncher : public AActor
{
	GENERATED_BODY()

public:
	AAlpineProjectileLauncher();

	UFUNCTION(BlueprintCallable, Category = "Alpine|Projectile Test")
	void SetTargetActor(AActor* NewTarget);

	UFUNCTION(BlueprintCallable, Category = "Alpine|Projectile Test")
	AAlpineTestProjectile* FireProjectile();

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	bool IsAutomaticFireEnabled() const { return bAutomaticFire; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	float GetFireInterval() const { return FireInterval; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	float GetFirstShotDelay() const { return FirstShotDelay; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	TSubclassOf<AAlpineTestProjectile> GetProjectileClass() const
	{
		return ProjectileClass;
	}

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	UPROPERTY(
		VisibleAnywhere,
		BlueprintReadOnly,
		Category = "Alpine|Projectile Test",
		meta = (AllowPrivateAccess = "true"))
	TObjectPtr<USceneComponent> SceneRoot;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Projectile Test")
	TObjectPtr<UStaticMeshComponent> BaseMesh;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Projectile Test")
	TObjectPtr<UStaticMeshComponent> LauncherMesh;

	UPROPERTY(VisibleAnywhere, Category = "Alpine|Projectile Test")
	TObjectPtr<UTextRenderComponent> InstructionText;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CylinderMesh;

	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test")
	TSubclassOf<AAlpineTestProjectile> ProjectileClass;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test")
	bool bAutomaticFire = true;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test",
		meta = (ClampMin = "0.25"))
	float FireInterval = 4.0f;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test",
		meta = (ClampMin = "0.0"))
	float FirstShotDelay = 3.0f;

	UPROPERTY(Transient)
	TObjectPtr<AActor> TargetActor;

	FTimerHandle FireTimer;

	FVector GetMuzzleLocation() const;
	void FireAutomatically();
	void ConfigureMaterials();
};
