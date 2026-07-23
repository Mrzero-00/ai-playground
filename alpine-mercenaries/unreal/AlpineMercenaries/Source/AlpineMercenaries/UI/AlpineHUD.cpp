#include "UI/AlpineHUD.h"

#include "Character/AlpineMercenaryCharacter.h"
#include "Character/AlpineVitalsComponent.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "GameFramework/PlayerController.h"
#include "Player/AlpinePlayerController.h"
#include "Weapon/AlpineWeaponComponent.h"
#include "Weapon/AlpineWeaponTypes.h"

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

		const FString ComboLabel = FString::Printf(
			TEXT("LMB COMBO NEXT %d: %s"),
			Weapon->GetNextPrimaryComboStep(),
			*Weapon->GetNextPrimaryAttackLabel().ToString());
		DrawText(
			ComboLabel,
			FLinearColor(0.76f, 0.85f, 0.92f, 1.0f),
			X,
			Y - 74.0f,
			GEngine ? GEngine->GetSmallFont() : nullptr,
			0.9f,
			false);

		const FString SkillLabel = FString::Printf(
			TEXT("1 %s  |  2 %s  |  3 %s"),
			*Weapon->GetSpecialAttackLabel(1).ToString(),
			*Weapon->GetSpecialAttackLabel(2).ToString(),
			*Weapon->GetSpecialAttackLabel(3).ToString());
		DrawText(
			SkillLabel,
			FLinearColor(0.65f, 0.78f, 1.0f, 1.0f),
			X,
			Y - 94.0f,
			GEngine ? GEngine->GetSmallFont() : nullptr,
			0.85f,
			false);

#if !UE_BUILD_SHIPPING
		DrawDevelopmentWeaponSelector(*Weapon);
#endif
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

void AAlpineHUD::NotifyHitBoxClick(FName BoxName)
{
	Super::NotifyHitBoxClick(BoxName);

#if UE_BUILD_SHIPPING
	return;
#else
	const AAlpineMercenaryCharacter* Character =
		PlayerOwner
			? Cast<AAlpineMercenaryCharacter>(PlayerOwner->GetPawn())
			: nullptr;
	UAlpineWeaponComponent* Weapon =
		Character ? Character->GetWeaponComponent() : nullptr;
	if (!Weapon)
	{
		return;
	}

	if (BoxName == TEXT("DevWeaponSwordShield"))
	{
		Weapon->EquipWeapon(EAlpineWeaponType::SwordAndShield);
	}
	else if (BoxName == TEXT("DevWeaponBow"))
	{
		Weapon->EquipWeapon(EAlpineWeaponType::Bow);
	}
	else if (BoxName == TEXT("DevWeaponGreatsword"))
	{
		Weapon->EquipWeapon(EAlpineWeaponType::Greatsword);
	}
#endif
}

void AAlpineHUD::DrawDevelopmentWeaponSelector(
	const UAlpineWeaponComponent& Weapon)
{
	const AAlpinePlayerController* AlpineController =
		Cast<AAlpinePlayerController>(PlayerOwner);
	const bool bSelectorOpen =
		AlpineController &&
		AlpineController->IsDevelopmentWeaponSelectorOpen();

	const float ButtonWidth = 150.0f;
	const float ButtonHeight = 38.0f;
	const float ButtonGap = 10.0f;
	const float TotalWidth = ButtonWidth * 3.0f + ButtonGap * 2.0f;
	const float StartX = (Canvas->ClipX - TotalWidth) * 0.5f;
	const float ButtonY = Canvas->ClipY - ButtonHeight - 18.0f;

	DrawText(
		bSelectorOpen
			? TEXT("[DEV] CLICK A WEAPON - TAB TO CLOSE")
			: TEXT("[DEV] TAB: OPEN TEMPORARY WEAPON SELECTOR"),
		FLinearColor(0.72f, 0.76f, 0.8f, 1.0f),
		StartX,
		ButtonY - 22.0f,
		GEngine ? GEngine->GetSmallFont() : nullptr,
		0.8f,
		false);

	struct FWeaponButton
	{
		EAlpineWeaponType WeaponType;
		FName HitBoxName;
		const TCHAR* Label;
	};
	const FWeaponButton Buttons[] = {
		{
			EAlpineWeaponType::SwordAndShield,
			TEXT("DevWeaponSwordShield"),
			TEXT("SWORD & SHIELD")
		},
		{
			EAlpineWeaponType::Bow,
			TEXT("DevWeaponBow"),
			TEXT("LONGBOW")
		},
		{
			EAlpineWeaponType::Greatsword,
			TEXT("DevWeaponGreatsword"),
			TEXT("GREATSWORD")
		}
	};

	for (int32 ButtonIndex = 0; ButtonIndex < 3; ++ButtonIndex)
	{
		const FWeaponButton& Button = Buttons[ButtonIndex];
		const float ButtonX =
			StartX + ButtonIndex * (ButtonWidth + ButtonGap);
		const bool bEquipped =
			Weapon.GetEquippedWeaponType() == Button.WeaponType;
		const FLinearColor FillColor = bEquipped
			? FLinearColor(0.72f, 0.48f, 0.08f, 0.94f)
			: FLinearColor(0.08f, 0.1f, 0.13f, 0.9f);

		DrawRect(
			FLinearColor(0.02f, 0.025f, 0.03f, 0.95f),
			ButtonX - 2.0f,
			ButtonY - 2.0f,
			ButtonWidth + 4.0f,
			ButtonHeight + 4.0f);
		DrawRect(
			FillColor,
			ButtonX,
			ButtonY,
			ButtonWidth,
			ButtonHeight);
		DrawText(
			Button.Label,
			FLinearColor::White,
			ButtonX + 14.0f,
			ButtonY + 10.0f,
			GEngine ? GEngine->GetSmallFont() : nullptr,
			0.85f,
			false);

		if (bSelectorOpen)
		{
			AddHitBox(
				FVector2D(ButtonX, ButtonY),
				FVector2D(ButtonWidth, ButtonHeight),
				Button.HitBoxName,
				true,
				100);
		}
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
