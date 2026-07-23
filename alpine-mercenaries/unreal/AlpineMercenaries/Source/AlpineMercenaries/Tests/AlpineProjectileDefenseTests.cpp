#if WITH_DEV_AUTOMATION_TESTS

#include "Character/AlpineMercenaryCharacter.h"
#include "Character/AlpineVitalsComponent.h"
#include "Combat/AlpineProjectileLauncher.h"
#include "Combat/AlpineTestProjectile.h"
#include "Game/AlpineGameMode.h"
#include "Weapon/AlpineWeaponComponent.h"
#include "Weapon/AlpineWeaponTypes.h"

#include "Components/SphereComponent.h"
#include "Engine/DamageEvents.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/ProjectileMovementComponent.h"
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FAlpineProjectileDefenseTest,
	"AlpineMercenaries.Combat.ProjectileDefense",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FAlpineProjectileDefenseTest::RunTest(const FString& Parameters)
{
	const FVector GuardOrigin = FVector::ZeroVector;
	const FVector GuardForward = FVector::ForwardVector;
	TestTrue(
		TEXT("An active guard blocks point damage arriving from the front"),
		IsAlpinePointDamageBlocked(
			true,
			GuardOrigin,
			GuardForward,
			FVector(42.0f, 0.0f, 55.0f)));
	TestFalse(
		TEXT("Point damage is not blocked while guard is inactive"),
		IsAlpinePointDamageBlocked(
			false,
			GuardOrigin,
			GuardForward,
			FVector(42.0f, 0.0f, 55.0f)));
	TestFalse(
		TEXT("An active guard does not block point damage from behind"),
		IsAlpinePointDamageBlocked(
			true,
			GuardOrigin,
			GuardForward,
			FVector(-42.0f, 0.0f, 55.0f)));

	const AAlpineTestProjectile* Projectile =
		GetDefault<AAlpineTestProjectile>();
	TestNotNull(TEXT("Projectile class default"), Projectile);
	if (Projectile)
	{
		TestEqual(
			TEXT("Test projectile deals 20 HP damage"),
			Projectile->GetDamage(),
			20.0f);
		TestEqual(
			TEXT("Test projectile travels at a readable speed"),
			Projectile->GetProjectileSpeed(),
			700.0f);
		TestEqual(
			TEXT("Test projectile expires if it misses"),
			Projectile->GetMaximumLifetime(),
			8.0f);
		TestFalse(
			TEXT("Test projectile cannot receive damage"),
			Projectile->CanBeDamaged());

		const USphereComponent* Collision =
			Projectile->GetCollisionComponent();
		TestNotNull(TEXT("Projectile owns collision"), Collision);
		if (Collision)
		{
			TestEqual(
				TEXT("Projectile collision blocks players"),
				Collision->GetCollisionResponseToChannel(ECC_Pawn),
				ECR_Block);
			TestEqual(
				TEXT("Projectile collision blocks the level"),
				Collision->GetCollisionResponseToChannel(ECC_WorldStatic),
				ECR_Block);
		}

		const UProjectileMovementComponent* Movement =
			Projectile->GetProjectileMovement();
		TestNotNull(TEXT("Projectile owns movement"), Movement);
		if (Movement)
		{
			TestEqual(
				TEXT("Projectile movement uses the configured speed"),
				Movement->MaxSpeed,
				Projectile->GetProjectileSpeed());
			TestEqual(
				TEXT("Test projectile does not fall"),
				Movement->ProjectileGravityScale,
				0.0f);
		}
	}

	const AAlpineProjectileLauncher* Launcher =
		GetDefault<AAlpineProjectileLauncher>();
	TestNotNull(TEXT("Projectile launcher class default"), Launcher);
	if (Launcher)
	{
		TestTrue(
			TEXT("Projectile launcher automatically fires"),
			Launcher->IsAutomaticFireEnabled());
		TestEqual(
			TEXT("Projectile launcher fires every four seconds"),
			Launcher->GetFireInterval(),
			4.0f);
		TestEqual(
			TEXT("The first projectile gives the player time to prepare"),
			Launcher->GetFirstShotDelay(),
			3.0f);
		TestTrue(
			TEXT("Launcher uses the shield test projectile"),
			Launcher->GetProjectileClass().Get() ==
				AAlpineTestProjectile::StaticClass());
		TestFalse(
			TEXT("Projectile launcher is stationary"),
			Launcher->IsActorTickEnabled());
	}

	const AAlpineMercenaryCharacter* Character =
		GetDefault<AAlpineMercenaryCharacter>();
	TestNotNull(TEXT("Mercenary character class default"), Character);
	if (Character)
	{
		TestTrue(
			TEXT("Mercenary character accepts incoming damage"),
			Character->CanBeDamaged());
		TestEqual(
			TEXT("Blocked hit count starts at zero"),
			Character->GetBlockedPointHitCount(),
			0);
		TestEqual(
			TEXT("Last blocked damage starts at zero"),
			Character->GetLastBlockedDamage(),
			0.0f);
	}

	const AAlpineGameMode* GameMode = GetDefault<AAlpineGameMode>();
	TestNotNull(TEXT("Alpine game mode class default"), GameMode);
	if (GameMode)
	{
		TestTrue(
			TEXT("Development map automatically spawns the projectile launcher"),
			GameMode->ShouldSpawnProjectileLauncher());
	}

	UWorld* TestWorld = nullptr;
	UGameInstance* TestGameInstance = nullptr;
	if (GEngine)
	{
		TestWorld = UWorld::CreateWorld(EWorldType::Game, false);
		if (TestWorld)
		{
			FWorldContext& WorldContext =
				GEngine->CreateNewWorldContext(EWorldType::Game);
			WorldContext.SetCurrentWorld(TestWorld);
			TestGameInstance = NewObject<UGameInstance>(GEngine);
			WorldContext.OwningGameInstance = TestGameInstance;
			TestWorld->SetGameInstance(TestGameInstance);
			const FURL TestUrl;
			TestTrue(
				TEXT("Damage integration world creates an authority game mode"),
				TestWorld->SetGameMode(TestUrl));
			TestWorld->InitializeActorsForPlay(TestUrl);
		}
	}
	TestNotNull(TEXT("Automation test has a world for damage integration"), TestWorld);
	if (TestWorld)
	{
		const FVector CharacterLocation(0.0f, 0.0f, 10000.0f);
		FActorSpawnParameters SpawnParameters;
		SpawnParameters.ObjectFlags |= RF_Transient;
		SpawnParameters.SpawnCollisionHandlingOverride =
			ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

		AAlpineMercenaryCharacter* TestCharacter =
			TestWorld->SpawnActor<AAlpineMercenaryCharacter>(
				AAlpineMercenaryCharacter::StaticClass(),
				CharacterLocation,
				FRotator::ZeroRotator,
				SpawnParameters);
		AAlpineTestProjectile* DamageSource =
			TestWorld->SpawnActor<AAlpineTestProjectile>(
			AAlpineTestProjectile::StaticClass(),
			CharacterLocation + FVector(80.0f, 0.0f, 55.0f),
			FRotator::ZeroRotator,
			SpawnParameters);
		TestNotNull(TEXT("Damage integration character spawned"), TestCharacter);
		TestNotNull(TEXT("Damage source spawned"), DamageSource);

		if (TestCharacter && DamageSource)
		{
			TestTrue(
				TEXT("Damage integration character has server authority"),
				TestCharacter->HasAuthority());
			TestTrue(
				TEXT("Damage integration character can receive damage"),
				TestCharacter->CanBeDamaged());
			UAlpineWeaponComponent* TestWeapon =
				TestCharacter->GetWeaponComponent();
			UAlpineVitalsComponent* TestVitals =
				TestCharacter->GetVitalsComponent();
			TestNotNull(TEXT("Damage integration weapon component"), TestWeapon);
			TestNotNull(TEXT("Damage integration vitals component"), TestVitals);

			if (TestWeapon && TestVitals)
			{
				FPointDamageEvent PointDamageEvent;
				PointDamageEvent.Damage = 20.0f;
				PointDamageEvent.ShotDirection = -FVector::ForwardVector;

				TestTrue(
					TEXT("Sword and shield guard starts for integration test"),
					TestWeapon->StartRoleAction());
				TestEqual(
					TEXT("Front projectile returns zero damage while guarding"),
					TestCharacter->TakeDamage(
						20.0f,
						PointDamageEvent,
						nullptr,
						DamageSource),
					0.0f);
				TestEqual(
					TEXT("Guarded projectile leaves HP unchanged"),
					TestVitals->GetHealth(),
					100.0f);
				TestEqual(
					TEXT("Guarded projectile increments the block counter"),
					TestCharacter->GetBlockedPointHitCount(),
					1);
				TestEqual(
					TEXT("Guarded projectile records the prevented damage"),
					TestCharacter->GetLastBlockedDamage(),
					20.0f);

				TestTrue(
					TEXT("Guard releases before the unblocked hit"),
					TestWeapon->ReleaseRoleAction());
				TestEqual(
					TEXT("Front projectile applies damage after guard release"),
					TestCharacter->TakeDamage(
						20.0f,
						PointDamageEvent,
						nullptr,
						DamageSource),
					20.0f);
				TestEqual(
					TEXT("Unblocked projectile reduces HP"),
					TestVitals->GetHealth(),
					80.0f);
			}
		}

		if (DamageSource)
		{
			DamageSource->Destroy();
		}
		if (TestCharacter)
		{
			TestCharacter->Destroy();
		}

		GEngine->DestroyWorldContext(TestWorld);
		TestWorld->DestroyWorld(false);
	}

	return true;
}

#endif
