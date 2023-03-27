import { NestFactory } from '@nestjs/core';
import { MongoClient } from 'mongodb';
import { MongoDBStorage, Umzug } from 'umzug';
import { Community } from '../community/schemas/community.schema';
import { DB_URL_ROOT, DB_NAME_MAIN } from '../constants/constants.provider';
import { PeriodsService } from '../periods/services/periods.service';
import { PeriodSettingsService } from '../periodsettings/periodsettings.service';
import { PraiseService } from '../praise/services/praise.service';
import { QuantificationsService } from '../quantifications/services/quantifications.service';
import { SettingsService } from '../settings/settings.service';
import { logger } from '../shared/logger';
import { UsersService } from '../users/users.service';
import { AppMigrationsModule } from './modules/app-migrations.module';
import { dbUrlCommunity } from './utils/community-db-url';
import mongoose, { ConnectOptions } from 'mongoose';

export class MigrationsManager {
  /**
   * Run db migrations for named community. The migrations are run in the context of the community db.
   * A dynamic module is created for the community db and the context is passed to the migrations.
   */
  async migrate(community: Community) {
    try {
      logger.info(`🆙 Starting migrations for: ${community.hostname}`);

      // Connect to the community db
      const mongooseConn = await mongoose.connect(dbUrlCommunity(community), {
        useNewUrlParser: true,
      } as ConnectOptions);

      // Create a dynamic app module for the community
      const app = await NestFactory.createApplicationContext(
        AppMigrationsModule.forRoot(dbUrlCommunity(community)),
      );

      // Init the app
      await app.init();

      // Setup migrator
      const migrator = new Umzug({
        migrations: { glob: 'src/database/migrations/*.ts' },
        storage: new MongoDBStorage({
          connection: mongoose.connection,
        }),
        logger,
        context: {
          praiseService: app.get(PraiseService),
          usersService: app.get(UsersService),
          periodsService: app.get(PeriodsService),
          settingsService: app.get(SettingsService),
          periodSettingsService: app.get(PeriodSettingsService),
          quantificationsService: app.get(QuantificationsService),
        },
      });

      // Run the migrations
      await migrator.up();

      // Close the app
      await app.close();

      // Close the db connection
      await mongooseConn.disconnect();

      logger.info(`✅ Migrations completed for: ${community.hostname}`);
    } catch (error) {
      logger.error(error.message);
    }
  }

  /**
   * Run db migrations for all communities
   */
  async run(): Promise<void> {
    try {
      // Connect to the main db to access community list
      const mongodb = new MongoClient(DB_URL_ROOT);

      // Register ts-node to be able to run typescript migrations
      require('ts-node/register');

      // List all communities
      const dbMain = mongodb.db(DB_NAME_MAIN);
      const communities = await dbMain
        .collection('communities')
        .find()
        .toArray();

      // For each community, run the migrations
      for (const community of communities) {
        await this.migrate(community as Community);
      }

      // Cleanup
      mongodb.close();
    } catch (error) {
      logger.error(error.message);
    }
  }
}