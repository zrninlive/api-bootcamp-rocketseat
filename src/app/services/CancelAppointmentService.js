import { isBefore, subHours } from 'date-fns';

import Queue from '../../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';

import User from '../models/User';
import Appointment from '../models/Appointment';

import Cache from '../../lib/Cache';

class CancelAppointmentService {
  async run({ appointment_id, user_id }) {
    const appointment = await Appointment.findByPk(appointment_id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== user_id) {
      throw new Error("You don't have permission to cancel this appointment.");
    }

    /**
     * Verify if the current hour is at least 2 hours an advance to cancel
     */
    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      throw new Error('You can only cancel appointments 2 hours in advance');
    }

    appointment.canceled_at = new Date();
    await appointment.save();

    await Queue.add(CancellationMail.key, {
      appointment,
    });

    await Cache.invalidatePrefix(`user:${user_id}:appointments:`);

    return appointment;
  }
}

export default new CancelAppointmentService();
