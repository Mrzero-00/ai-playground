#include "Combat/AlpineTestProjectile.h"

#include "Components/PointLightComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/ProjectileMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/ConstructorHelpers.h"

AAlpineTestProjectile::AAlpineTestProjectile()
{
	PrimaryActorTick.bCanEverTick = false;
	SetCanBeDamaged(false);
	SetReplicates(true);
	SetReplicateMovement(true);

	CollisionSphere =
		CreateDefaultSubobject<USphereComponent>(TEXT("CollisionSphere"));
	CollisionSphere->InitSphereRadius(18.0f);
	CollisionSphere->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	CollisionSphere->SetCollisionObjectType(ECC_WorldDynamic);
	CollisionSphere->SetCollisionResponseToAllChannels(ECR_Ignore);
	CollisionSphere->SetCollisionResponseToChannel(ECC_Pawn, ECR_Block);
	CollisionSphere->SetCollisionResponseToChannel(ECC_WorldStatic, ECR_Block);
	CollisionSphere->SetNotifyRigidBodyCollision(true);
	CollisionSphere->SetGenerateOverlapEvents(false);
	CollisionSphere->SetCanEverAffectNavigation(false);
	CollisionSphere->OnComponentHit.AddDynamic(
		this,
		&AAlpineTestProjectile::HandleProjectileHit);
	SetRootComponent(CollisionSphere);

	ProjectileMesh =
		CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ProjectileMesh"));
	ProjectileMesh->SetupAttachment(CollisionSphere);
	ProjectileMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	ProjectileMesh->SetGenerateOverlapEvents(false);
	ProjectileMesh->SetCanEverAffectNavigation(false);
	ProjectileMesh->SetRelativeScale3D(FVector(0.34f));

	ProjectileLight =
		CreateDefaultSubobject<UPointLightComponent>(TEXT("ProjectileLight"));
	ProjectileLight->SetupAttachment(CollisionSphere);
	ProjectileLight->SetLightColor(FLinearColor(1.0f, 0.15f, 0.02f));
	ProjectileLight->SetIntensity(3500.0f);
	ProjectileLight->SetAttenuationRadius(220.0f);
	ProjectileLight->SetCastShadows(false);

	ProjectileMovement =
		CreateDefaultSubobject<UProjectileMovementComponent>(
			TEXT("ProjectileMovement"));
	ProjectileMovement->UpdatedComponent = CollisionSphere;
	ProjectileMovement->InitialSpeed = ProjectileSpeed;
	ProjectileMovement->MaxSpeed = ProjectileSpeed;
	ProjectileMovement->ProjectileGravityScale = 0.0f;
	ProjectileMovement->bRotationFollowsVelocity = true;
	ProjectileMovement->bShouldBounce = false;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (SphereAsset.Succeeded())
	{
		ProjectileMesh->SetStaticMesh(SphereAsset.Object);
	}
}

void AAlpineTestProjectile::BeginPlay()
{
	Super::BeginPlay();

	SetLifeSpan(MaximumLifetime);
}

void AAlpineTestProjectile::InitializeVelocity(const FVector& Direction)
{
	if (!ProjectileMovement)
	{
		return;
	}

	ProjectileMovement->Velocity =
		Direction.GetSafeNormal() * ProjectileSpeed;
}

void AAlpineTestProjectile::HandleProjectileHit(
	UPrimitiveComponent* HitComponent,
	AActor* OtherActor,
	UPrimitiveComponent* OtherComponent,
	FVector NormalImpulse,
	const FHitResult& Hit)
{
	if (!HasAuthority())
	{
		return;
	}

	if (OtherActor && OtherActor != this && OtherActor != GetOwner())
	{
		const FVector ShotDirection = GetVelocity().GetSafeNormal();
		UGameplayStatics::ApplyPointDamage(
			OtherActor,
			Damage,
			ShotDirection,
			Hit,
			GetInstigatorController(),
			this,
			nullptr);
	}

	Destroy();
}
