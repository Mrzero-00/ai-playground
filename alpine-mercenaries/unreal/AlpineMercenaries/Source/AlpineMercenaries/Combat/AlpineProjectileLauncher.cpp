#include "Combat/AlpineProjectileLauncher.h"

#include "Combat/AlpineTestProjectile.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

AAlpineProjectileLauncher::AAlpineProjectileLauncher()
{
	PrimaryActorTick.bCanEverTick = false;
	SetCanBeDamaged(false);
	SetReplicates(true);
	SetReplicateMovement(false);

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
	SetRootComponent(SceneRoot);

	BaseMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BaseMesh"));
	BaseMesh->SetupAttachment(SceneRoot);
	BaseMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	BaseMesh->SetCanEverAffectNavigation(false);
	BaseMesh->SetRelativeLocation(FVector(0.0f, 0.0f, 25.0f));
	BaseMesh->SetRelativeScale3D(FVector(0.8f, 0.8f, 0.5f));

	LauncherMesh =
		CreateDefaultSubobject<UStaticMeshComponent>(TEXT("LauncherMesh"));
	LauncherMesh->SetupAttachment(SceneRoot);
	LauncherMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	LauncherMesh->SetCanEverAffectNavigation(false);
	LauncherMesh->SetRelativeLocation(FVector(48.0f, 0.0f, 90.0f));
	LauncherMesh->SetRelativeRotation(FRotator(90.0f, 0.0f, 0.0f));
	LauncherMesh->SetRelativeScale3D(FVector(0.24f, 0.24f, 0.95f));

	InstructionText =
		CreateDefaultSubobject<UTextRenderComponent>(TEXT("InstructionText"));
	InstructionText->SetupAttachment(SceneRoot);
	InstructionText->SetRelativeLocation(FVector(0.0f, 0.0f, 175.0f));
	InstructionText->SetHorizontalAlignment(EHTA_Center);
	InstructionText->SetVerticalAlignment(EVRTA_TextCenter);
	InstructionText->SetWorldSize(21.0f);
	InstructionText->SetTextRenderColor(FColor(255, 116, 45));
	InstructionText->SetText(FText::FromString(
		TEXT("PROJECTILE TEST\nHOLD RMB TO GUARD\n20 DAMAGE / 4 SEC")));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(
		TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(
		TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	CylinderMesh = CylinderAsset.Object;
	BaseMaterial = MaterialAsset.Object;
	BaseMesh->SetStaticMesh(CylinderMesh);
	LauncherMesh->SetStaticMesh(CylinderMesh);

	ProjectileClass = AAlpineTestProjectile::StaticClass();
}

void AAlpineProjectileLauncher::BeginPlay()
{
	Super::BeginPlay();

	ConfigureMaterials();
	if (HasAuthority() && bAutomaticFire)
	{
		GetWorldTimerManager().SetTimer(
			FireTimer,
			this,
			&AAlpineProjectileLauncher::FireAutomatically,
			FireInterval,
			true,
			FirstShotDelay);
	}
}

void AAlpineProjectileLauncher::EndPlay(
	const EEndPlayReason::Type EndPlayReason)
{
	GetWorldTimerManager().ClearTimer(FireTimer);
	Super::EndPlay(EndPlayReason);
}

void AAlpineProjectileLauncher::SetTargetActor(AActor* NewTarget)
{
	if (HasAuthority())
	{
		TargetActor = NewTarget;
	}
}

AAlpineTestProjectile* AAlpineProjectileLauncher::FireProjectile()
{
	if (!HasAuthority() || !ProjectileClass || !GetWorld())
	{
		return nullptr;
	}

	if (!IsValid(TargetActor))
	{
		TargetActor = UGameplayStatics::GetPlayerPawn(this, 0);
	}
	if (!IsValid(TargetActor))
	{
		return nullptr;
	}

	const FVector MuzzleLocation = GetMuzzleLocation();
	const FVector TargetLocation =
		TargetActor->GetActorLocation() + FVector::UpVector * 55.0f;
	const FVector ShotDirection =
		(TargetLocation - MuzzleLocation).GetSafeNormal();
	if (ShotDirection.IsNearlyZero())
	{
		return nullptr;
	}

	FActorSpawnParameters SpawnParameters;
	SpawnParameters.Owner = this;
	SpawnParameters.SpawnCollisionHandlingOverride =
		ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AAlpineTestProjectile* Projectile =
		GetWorld()->SpawnActor<AAlpineTestProjectile>(
			ProjectileClass,
			MuzzleLocation,
			ShotDirection.Rotation(),
			SpawnParameters);
	if (Projectile)
	{
		Projectile->InitializeVelocity(ShotDirection);
	}
	return Projectile;
}

FVector AAlpineProjectileLauncher::GetMuzzleLocation() const
{
	return GetActorTransform().TransformPosition(FVector(105.0f, 0.0f, 90.0f));
}

void AAlpineProjectileLauncher::FireAutomatically()
{
	FireProjectile();
}

void AAlpineProjectileLauncher::ConfigureMaterials()
{
	if (!BaseMaterial)
	{
		return;
	}

	BaseMesh->SetMaterial(0, BaseMaterial);
	if (UMaterialInstanceDynamic* BaseDynamic =
			BaseMesh->CreateAndSetMaterialInstanceDynamic(0))
	{
		BaseDynamic->SetVectorParameterValue(
			TEXT("Color"),
			FLinearColor(0.08f, 0.09f, 0.11f, 1.0f));
	}

	LauncherMesh->SetMaterial(0, BaseMaterial);
	if (UMaterialInstanceDynamic* LauncherDynamic =
			LauncherMesh->CreateAndSetMaterialInstanceDynamic(0))
	{
		LauncherDynamic->SetVectorParameterValue(
			TEXT("Color"),
			FLinearColor(0.9f, 0.16f, 0.03f, 1.0f));
	}
}
