#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "AlpineGameMode.generated.h"

class AAlpineTrainingTarget;
class AAlpineProjectileLauncher;

UCLASS()
class ALPINEMERCENARIES_API AAlpineGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AAlpineGameMode();

	UFUNCTION(BlueprintPure, Category = "Alpine|Training Target")
	AAlpineTrainingTarget* GetTrainingTarget() const { return TrainingTarget; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Training Target")
	bool ShouldSpawnTrainingTarget() const { return bSpawnTrainingTarget; }

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	AAlpineProjectileLauncher* GetProjectileLauncher() const
	{
		return ProjectileLauncher;
	}

	UFUNCTION(BlueprintPure, Category = "Alpine|Projectile Test")
	bool ShouldSpawnProjectileLauncher() const
	{
		return bSpawnProjectileLauncher;
	}

protected:
	virtual void RestartPlayer(AController* NewPlayer) override;

private:
	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Training Target")
	bool bSpawnTrainingTarget = true;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Training Target",
		meta = (ClampMin = "150.0"))
	float TrainingTargetSpawnDistance = 300.0f;

	UPROPERTY(Transient)
	TObjectPtr<AAlpineTrainingTarget> TrainingTarget;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test")
	bool bSpawnProjectileLauncher = true;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test",
		meta = (ClampMin = "400.0"))
	float ProjectileLauncherSpawnDistance = 700.0f;

	UPROPERTY(
		EditDefaultsOnly,
		Category = "Alpine|Projectile Test")
	float ProjectileLauncherLateralOffset = 250.0f;

	UPROPERTY(Transient)
	TObjectPtr<AAlpineProjectileLauncher> ProjectileLauncher;

	void EnsureTrainingTarget(AController* PlayerController);
	void EnsureProjectileLauncher(AController* PlayerController);
};
