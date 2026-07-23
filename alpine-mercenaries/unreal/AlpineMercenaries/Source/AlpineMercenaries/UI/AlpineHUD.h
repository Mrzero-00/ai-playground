#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "AlpineHUD.generated.h"

UCLASS()
class ALPINEMERCENARIES_API AAlpineHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

private:
	void DrawResourceBar(
		const FString& Label,
		float CurrentValue,
		float MaxValue,
		const FLinearColor& FillColor,
		float X,
		float Y,
		float Width,
		float Height);
};
