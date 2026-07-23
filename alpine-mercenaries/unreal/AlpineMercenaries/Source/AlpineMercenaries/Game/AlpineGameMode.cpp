#include "Game/AlpineGameMode.h"

#include "Character/AlpineMercenaryCharacter.h"
#include "Combat/AlpineProjectileLauncher.h"
#include "Combat/AlpineTrainingTarget.h"
#include "Engine/World.h"
#include "GameFramework/Controller.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Player/AlpinePlayerController.h"
#include "UI/AlpineHUD.h"

AAlpineGameMode::AAlpineGameMode()
{
	DefaultPawnClass = AAlpineMercenaryCharacter::StaticClass();
	PlayerControllerClass = AAlpinePlayerController::StaticClass();
	HUDClass = AAlpineHUD::StaticClass();
}

void AAlpineGameMode::RestartPlayer(AController* NewPlayer)
{
	Super::RestartPlayer(NewPlayer);
	EnsureTrainingTarget(NewPlayer);
	EnsureProjectileLauncher(NewPlayer);
}

void AAlpineGameMode::EnsureTrainingTarget(AController* PlayerController)
{
	if (!bSpawnTrainingTarget ||
		!HasAuthority() ||
		!PlayerController ||
		!PlayerController->GetPawn())
	{
		return;
	}

	if (IsValid(TrainingTarget))
	{
		return;
	}

	if (AActor* ExistingTarget = UGameplayStatics::GetActorOfClass(
			this,
			AAlpineTrainingTarget::StaticClass()))
	{
		TrainingTarget = Cast<AAlpineTrainingTarget>(ExistingTarget);
		return;
	}

	APawn* PlayerPawn = PlayerController->GetPawn();
	FVector Forward = PlayerPawn->GetActorForwardVector();
	Forward.Z = 0.0f;
	if (!Forward.Normalize())
	{
		Forward = FVector::ForwardVector;
	}

	FVector SpawnLocation =
		PlayerPawn->GetActorLocation() +
		Forward * TrainingTargetSpawnDistance;
	const float TargetHalfHeight =
		GetDefault<AAlpineTrainingTarget>()->GetCollisionHalfHeight();
	FCollisionQueryParams FloorQuery(
		SCENE_QUERY_STAT(AlpineTrainingTargetFloor),
		false,
		PlayerPawn);
	FHitResult FloorHit;
	const FVector FloorTraceStart =
		SpawnLocation + FVector::UpVector * 250.0f;
	const FVector FloorTraceEnd =
		SpawnLocation - FVector::UpVector * 600.0f;
	if (GetWorld()->LineTraceSingleByChannel(
			FloorHit,
			FloorTraceStart,
			FloorTraceEnd,
			ECC_Visibility,
			FloorQuery))
	{
		SpawnLocation.Z =
			FloorHit.ImpactPoint.Z + TargetHalfHeight;
	}

	FRotator SpawnRotation =
		(PlayerPawn->GetActorLocation() - SpawnLocation).Rotation();
	SpawnRotation.Pitch = 0.0f;
	SpawnRotation.Roll = 0.0f;

	FActorSpawnParameters SpawnParameters;
	SpawnParameters.SpawnCollisionHandlingOverride =
		ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	TrainingTarget = GetWorld()->SpawnActor<AAlpineTrainingTarget>(
		SpawnLocation,
		SpawnRotation,
		SpawnParameters);
}

void AAlpineGameMode::EnsureProjectileLauncher(
	AController* PlayerController)
{
	if (!bSpawnProjectileLauncher ||
		!HasAuthority() ||
		!PlayerController ||
		!PlayerController->GetPawn())
	{
		return;
	}

	APawn* PlayerPawn = PlayerController->GetPawn();
	if (IsValid(ProjectileLauncher))
	{
		ProjectileLauncher->SetTargetActor(PlayerPawn);
		return;
	}

	if (AActor* ExistingLauncher = UGameplayStatics::GetActorOfClass(
			this,
			AAlpineProjectileLauncher::StaticClass()))
	{
		ProjectileLauncher =
			Cast<AAlpineProjectileLauncher>(ExistingLauncher);
		ProjectileLauncher->SetTargetActor(PlayerPawn);
		return;
	}

	FVector Forward = PlayerPawn->GetActorForwardVector();
	Forward.Z = 0.0f;
	if (!Forward.Normalize())
	{
		Forward = FVector::ForwardVector;
	}
	const FVector Right = FVector::CrossProduct(FVector::UpVector, Forward);
	FVector SpawnLocation =
		PlayerPawn->GetActorLocation() +
		Forward * ProjectileLauncherSpawnDistance +
		Right * ProjectileLauncherLateralOffset;

	FCollisionQueryParams FloorQuery(
		SCENE_QUERY_STAT(AlpineProjectileLauncherFloor),
		false,
		PlayerPawn);
	FHitResult FloorHit;
	if (GetWorld()->LineTraceSingleByChannel(
			FloorHit,
			SpawnLocation + FVector::UpVector * 250.0f,
			SpawnLocation - FVector::UpVector * 600.0f,
			ECC_Visibility,
			FloorQuery))
	{
		SpawnLocation.Z = FloorHit.ImpactPoint.Z;
	}

	FRotator SpawnRotation =
		(PlayerPawn->GetActorLocation() - SpawnLocation).Rotation();
	SpawnRotation.Pitch = 0.0f;
	SpawnRotation.Roll = 0.0f;

	FActorSpawnParameters SpawnParameters;
	SpawnParameters.SpawnCollisionHandlingOverride =
		ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	ProjectileLauncher =
		GetWorld()->SpawnActor<AAlpineProjectileLauncher>(
			SpawnLocation,
			SpawnRotation,
			SpawnParameters);
	if (ProjectileLauncher)
	{
		ProjectileLauncher->SetTargetActor(PlayerPawn);
	}
}
