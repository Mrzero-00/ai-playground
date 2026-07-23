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
	bool IsDevelopmentWeaponSelectorOpen() const
	{
		return bDevelopmentWeaponSelectorOpen;
	}

protected:
	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;
	virtual void OnPossess(APawn* InPawn) override;

private:
	void ApplyDefaultViewRotation();
	void ScheduleDefaultViewRotation();
	void ToggleDevelopmentWeaponSelector();
	void SetDevelopmentWeaponSelectorOpen(bool bOpen);

	UPROPERTY()
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY()
	TObjectPtr<UInputMappingContext> MouseLookMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Alpine|Camera")
	float DefaultViewPitch = -12.0f;

	bool bDevelopmentWeaponSelectorOpen = false;
	FTimerHandle InitialViewResetTimer;
};
