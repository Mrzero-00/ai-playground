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

protected:
	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;

private:
	UPROPERTY()
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY()
	TObjectPtr<UInputMappingContext> MouseLookMappingContext;
};
