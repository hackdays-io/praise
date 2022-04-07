import { PraiseModel } from 'api/dist/praise/entities';
import { UserAccountModel } from 'api/dist/useraccount/entities';
import { UserAccount } from 'api/src/useraccount/types';
import { CommandInteraction, Message } from 'discord.js';
import logger from 'jet-logger';
import { getSetting } from '../utils/getSettings';
import {
  dmError,
  invalidReceiverError,
  missingReasonError,
  notActivatedDM,
  notActivatedError,
  praiseSuccess,
  praiseSuccessDM,
  roleError,
  roleMentionWarning,
  undefinedReceiverWarning,
} from '../utils/praiseEmbeds';

export const praiseHandler = async (
  interaction: CommandInteraction,
  responseUrl: string
): Promise<void> => {
  const { guild, channel, member } = interaction;

  if (!guild || !member) {
    await interaction.editReply(await dmError());
    return;
  }

  const praiseGiverRoleID = await getSetting('PRAISE_GIVER_ROLE_ID');
  const praiseGiverRole = guild.roles.cache.find(
    (r) => r.id === praiseGiverRoleID
  );
  const praiseGiver = await guild.members.fetch(member.user.id);

  if (
    praiseGiverRole &&
    !praiseGiver.roles.cache.find((r) => r.id === praiseGiverRole?.id)
  ) {
    await interaction.editReply({
      embeds: [await roleError(praiseGiverRole, praiseGiver.user)],
    });

    return;
  }

  const ua = {
    accountId: member.user.id,
    name: member.user.username + '#' + member.user.discriminator,
    avatarId: member.user.avatar,
    platform: 'DISCORD',
  } as UserAccount;

  const userAccount = await UserAccountModel.findOneAndUpdate(
    { accountId: ua.accountId },
    ua,
    { upsert: true, new: true }
  );

  const receivers = interaction.options.getString('receivers');
  const reason = interaction.options.getString('reason');

  const receiverData = {
    validReceiverIds: receivers?.match(/<@!([0-9]+)>/g),
    undefinedReceivers: receivers?.match(/@([a-z0-9]+)/gi),
    roleMentions: receivers?.match(/<@&([0-9]+)>/g),
  };

  if (
    !receivers ||
    receivers.length === 0 ||
    !receiverData.validReceiverIds ||
    receiverData.validReceiverIds?.length === 0
  ) {
    await interaction.editReply(await invalidReceiverError());
    return;
  }

  if (!reason || reason.length === 0) {
    await interaction.editReply(await missingReasonError());
    return;
  }

  if (!userAccount.user) {
    await interaction.editReply(await notActivatedError());
    return;
  }

  const praised: string[] = [];
  const receiverIds = receiverData.validReceiverIds.map((id) =>
    id.substr(3, id.length - 4)
  );
  const Receivers = (await guild.members.fetch({ user: receiverIds })).map(
    (u) => u
  );

  const guildChannel = await guild.channels.fetch(channel?.id || '');

  for (const receiver of Receivers) {
    const ra = {
      accountId: receiver.user.id,
      name: receiver.user.username + '#' + receiver.user.discriminator,
      avatarId: receiver.user.avatar,
      platform: 'DISCORD',
    } as UserAccount;
    const receiverAccount = await UserAccountModel.findOneAndUpdate(
      { accountId: ra.accountId },
      ra,
      { upsert: true, new: true }
    );

    if (!receiverAccount.user) {
      try {
        await receiver.send({ embeds: [await notActivatedDM(responseUrl)] });
      } catch (err) {
        logger.warn(`Can't DM user - ${ra.name} [${ra.accountId}]`);
      }
    }
    const praiseObj = await PraiseModel.create({
      reason: reason,
      giver: userAccount._id,
      sourceId: `DISCORD:${guild.id}:${interaction.channelId}`,
      sourceName: `DISCORD:${encodeURIComponent(
        guild.name
      )}:${encodeURIComponent(guildChannel?.name || '')}`,
      receiver: receiverAccount._id,
    });
    if (praiseObj) {
      try {
        await receiver.send({ embeds: [await praiseSuccessDM(responseUrl)] });
      } catch (err) {
        logger.warn(`Can't DM user - ${ra.name} [${ra.accountId}]`);
      }
      praised.push(ra.accountId);
    } else {
      logger.err(
        `Praise not registered for [${ua.accountId}] -> [${ra.accountId}] for [${reason}]`
      );
    }
  }

  const msg = (await interaction.editReply(
    await praiseSuccess(
      praised.map((id) => `<@!${id}>`),
      reason
    )
  )) as Message;

  if (receiverData.undefinedReceivers) {
    await msg.reply(
      await undefinedReceiverWarning(
        receiverData.undefinedReceivers.join(', '),
        praiseGiver.user
      )
    );
  }
  if (receiverData.roleMentions) {
    await msg.reply(
      await roleMentionWarning(
        receiverData.roleMentions.join(', '),
        praiseGiver.user
      )
    );
  }

  return;
};