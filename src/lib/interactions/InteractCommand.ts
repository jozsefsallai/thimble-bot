import { Command } from '../../command';
import { CommandOptions } from 'discord-akairo';
import { Message, Guild, GuildMember, User } from 'discord.js';
import { InteractionType } from '../../models/Interaction';
import { getOptouts, interact } from '../interaction';
import ordinal from '../ordinal';
import fmt from '../fmt';

class InteractCommand extends Command {
  type: InteractionType;

  botReceiver: string = '';
  self: string = '';
  optedOut: string = '';
  botInteracted: string = '%%';
  botInteractedTwo: string = '%%';
  interactionDone: string = '%% %%';

  constructor(id: InteractionType, opts: CommandOptions) {
    super(id, {
      ...opts,
      channel: 'guild',
      args: [
        {
          id: 'member',
          type: 'member',
          prompt: {
            retry: 'Please provide a valid member.'
          }
        }
      ]
    });

    this.type = id;
  }

  async exec(message: Message, { member }: { member?: GuildMember }) {
    const sender = (member ? message.author : this.client.user) as User;
    const receiver = member ? member.user : message.author;

    const guild = message.guild as Guild;
    let ping = true;

    if (receiver.id === this.client.user?.id) {
      return this.say(message, this.botReceiver);
    }

    if (receiver.id === sender.id) {
      return this.say(message, this.self);
    }

    try {
      const optoutsSnapshot = await getOptouts(receiver.id, guild.id);
      const optouts = optoutsSnapshot
        .map(doc => doc.data().type);

      if (optouts.includes(this.type)) {
        return this.error(message, this.optedOut);
      }

      if (optouts.includes('mute')) {
        ping = false;
      }

      const newCount = await interact({
        sender: sender.id,
        receiver: receiver.id,
        guild: guild.id,
        type: this.type
      });

      const receiverString = ping
        ? receiver.toString()
        : receiver.username;

      if (sender.id === this.client.user?.id) {
        // FIXME
        return this.say(message,
          [
            fmt(this.botInteracted, receiverString),
            `${fmt(this.botInteractedTwo, newCount)} time${newCount === 1 ? '' : 's'}.`
          ].join(' ')
        );
      }

      const response = newCount === 1
        ? `**${fmt(this.interactionDone, sender.toString(), receiverString)} for the first time!**`
        : `**${fmt(this.interactionDone, sender.toString(), receiverString)}!** That's the **${ordinal(newCount)}** time already!`;

      return this.say(message, response);
    } catch (err) {
      return this.error(message, `Failed to interact with "${this.type}".`);
    }
  }
}

export default InteractCommand;
