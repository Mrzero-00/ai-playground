#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "AlpinePlayerController.generated.h"

class UInputMappingContext;

UCLASS()
class ALPINEMERCENARIES_API AAlpinePlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AAlpinePlayerController();

	UInputMappingContext* GetDefaultMappingContext() const { return DefaultMappingContext; }
	UInputMappingContext* GetMouseLookMappingContext() const { return MouseLookMappingContext; }
	float GetDefaultViewPitch() const { return DefaultViewPitch; }

protected:
	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;
	virtual void OnPossess(APawn* InPawn) override;

private:
	void ApplyDefaultViewRotation();
	void ScheduleDefaultViewRotation();

	UPROPERTY()
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY()
	TObjectPtr<UInputMappingContext> MouseLookMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float DefaultViewPitch = -12.0f;

	FTimerHandle InitialViewResetTimer;
};
