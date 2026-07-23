#include "UI/AlpineHUD.h"

#include "Character/AlpineMercenaryCharacter.h"
#include "Character/AlpineVitalsComponent.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "GameFramework/PlayerController.h"
#include "Weapon/AlpineWeaponComponent.h"

namespace
{
FString GetMovementStateLabel(const AAlpineMercenaryCharacter& Character)
{
	switch (Character.GetLocomotionMode())
	{
	case EAlpineLocomotionMode::Walking:
		return TEXT("WALK");
	case EAlpineLocomotionMode::Sprinting:
		return TEXT("SPRINT");
	case EAlpineLocomotionMode::Crouching:
		return TEXT("CROUCH");
	case EAlpineLocomotionMode::Airborne:
		return TEXT("AIRBORNE");
	case EAlpineLocomotionMode::Jogging:
	default:
		return TEXT("JOG");
	}
}
}

void AAlpineHUD::DrawHUD()
{
	Super::DrawHUD();

	if (!Canvas || !PlayerOwner)
	{
		return;
	}

	const AAlpineMercenaryCharacter* Character =
		Cast<AAlpineMercenaryCharacter>(PlayerOwner->GetPawn());
	const UAlpineVitalsComponent* Vitals =
		Character ? Character->GetVitalsComponent() : nullptr;
	const UAlpineWeaponComponent* Weapon =
		Character ? Character->GetWeaponComponent() : nullptr;
	if (!Vitals)
	{
		return;
	}

	const float BarWidth = 280.0f;
	const float BarHeight = 20.0f;
	const float BarGap = 8.0f;
	const float X = 48.0f;
	const int32 BarCount = Vitals->IsManaEnabled() ? 3 : 2;
	const float TotalHeight = BarCount * BarHeight + (BarCount - 1) * BarGap;
	float Y = Canvas->ClipY - TotalHeight - 42.0f;

	if (Weapon)
	{
		const FString WeaponLabel = FString::Printf(
			TEXT("%s  |  %s  |  %s"),
			*Weapon->GetWeaponDisplayName().ToString(),
			*Weapon->GetRoleName().ToString(),
			*Weapon->GetActionStateLabel().ToString());
		DrawText(
			WeaponLabel,
			FLinearColor(0.95f, 0.82f, 0.34f, 1.0f),
			X,
			Y - 52.0f,
			GEngine ? GEngine->GetSmallFont() : nullptr,
			1.0f,
			false);
	}

	DrawText(
		GetMovementStateLabel(*Character),
		FLinearColor(0.78f, 0.9f, 1.0f, 1.0f),
		X,
		Y - 28.0f,
		GEngine ? GEngine->GetSmallFont() : nullptr,
		1.0f,
		false);

	DrawResourceBar(
		TEXT("HP"),
		Vitals->GetHealth(),
		Vitals->GetMaxHealth(),
		FLinearColor(0.78f, 0.08f, 0.08f, 1.0f),
		X,
		Y,
		BarWidth,
		BarHeight);
	Y += BarHeight + BarGap;

	DrawResourceBar(
		TEXT("STAMINA"),
		Vitals->GetStamina(),
		Vitals->GetMaxStamina(),
		FLinearColor(0.12f, 0.72f, 0.28f, 1.0f),
		X,
		Y,
		BarWidth,
		BarHeight);
	Y += BarHeight + BarGap;

	if (Vitals->IsManaEnabled())
	{
		DrawResourceBar(
			TEXT("MP"),
			Vitals->GetMana(),
			Vitals->GetMaxMana(),
			FLinearColor(0.12f, 0.34f, 0.92f, 1.0f),
			X,
			Y,
			BarWidth,
			BarHeight);
	}
}

void AAlpineHUD::DrawResourceBar(
	const FString& Label,
	float CurrentValue,
	float MaxValue,
	const FLinearColor& FillColor,
	float X,
	float Y,
	float Width,
	float Height)
{
	const float Ratio =
		MaxValue > 0.0f ? FMath::Clamp(CurrentValue / MaxValue, 0.0f, 1.0f) : 0.0f;
	const FString ValueText = FString::Printf(
		TEXT("%s  %.0f / %.0f"),
		*Label,
		CurrentValue,
		MaxValue);

	DrawRect(FLinearColor(0.015f, 0.02f, 0.025f, 0.88f), X - 2.0f, Y - 2.0f, Width + 4.0f, Height + 4.0f);
	DrawRect(FLinearColor(0.08f, 0.09f, 0.1f, 0.92f), X, Y, Width, Height);
	DrawRect(FillColor, X, Y, Width * Ratio, Height);
	DrawText(
		ValueText,
		FLinearColor::White,
		X + 8.0f,
		Y + 1.0f,
		GEngine ? GEngine->GetSmallFont() : nullptr,
		0.9f,
		false);
}
