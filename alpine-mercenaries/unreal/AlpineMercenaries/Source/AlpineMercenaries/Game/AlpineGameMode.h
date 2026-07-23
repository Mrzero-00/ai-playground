#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "AlpineGameMode.generated.h"

class AAlpineTrainingTarget;

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

	void EnsureTrainingTarget(AController* PlayerController);
};
