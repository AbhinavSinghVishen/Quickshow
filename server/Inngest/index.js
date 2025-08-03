import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

//Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  //this async function will be executed only this the event 'clerk/user.created' get triggered
  //and when this event triggers this function recieves and event object and this event object contains: name, id, data etc..
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } =
      event.data;
    const userData = {
      _id: id,
      email: email_addresses[0].email_address,
      name: first_name + " " + last_name,
      image: image_url,
    };

    await User.create(userData);
  }
);

//Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-with-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    const { id } = event.data;
    await User.findByIdAndDelete(id);
  }
);

//Inngest function to update user data in database
const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } =
      event.data;
    const userData = {
      _id: id,
      email: email_addresses[0].email_address,
      name: first_name + " " + last_name,
      image: image_url,
    };
    await User.findByIdAndUpdate(id, userData);
  }
);

//Innest Function to cancel booking and release seats of show after 10 minutes of booking created if payment is not made

const releaseSeatsAndDeleteBooking = inngest.createFunction(
  { id: "release-seats-delete-booking" },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
    await step.sleepUntil("wait-for-10-minutes", tenMinutesLater);

    await step.run("check-payment-status", async () => {
      const bookingId = event.data.bookingId;
      const booking = await Booking.findById(bookingId);

      //If payment is not made, release seats and delete booking
      if (!booking.isPaid) {
        const show = await Show.findById(booking.show);
        booking.bookedSeats.forEach((seats) => {
          delete show.occupiedSeats[seats];
        });

        show.markModified("occupiedSeats");
        await show.save();
        await Booking.findByIdAndDelete(bookingId);
      }
    });
  }
);

//Inngest Function to send email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
  { id: "send-booking-confirmation-email" },
  { event: "app/show.booked" },
  async ({ event, step }) => {
    const { bookingId } = event.data;

    const booking = await Booking.findById(bookingId)
      .populate({
        path: "show",
        populate: {
          path: "movie",
          model: "Movie",
        },
      })
      .populate("user");

    if (!booking) {
      console.error(`Booking with ID ${bookingId} not found`);
      return;
    }

    console.log("Booking:", booking);
    console.log("User email:", booking.user.email);
    console.log("Movie:", booking.show.movie.title);
    try {
      await sendEmail({
        to: booking.user.email,
        subject: `Payment Confirmation "${booking.show.movie.title}" booked!`,
        body: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Booking Confirmed!</h1>
          </div>
          <div style="padding: 25px;">
              <p style="font-size: 16px;">Hi ${booking.user.name},</p>
              <p>Thank you for booking with us! We're excited to see you at the movies. Please find your booking details below.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 15px;">
                  <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: bold;">Movie:</td>
                      <td style="padding: 12px 0; text-align: right;">${
                        booking.show.movie.title
                      }</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: bold;">Date:</td>
                      <td style="padding: 12px 0; text-align: right;">${new Date(
                        booking.show.showDateTime
                      ).toLocaleDateString("en-IN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: bold;">Time:</td>
                      <td style="padding: 12px 0; text-align: right;">${new Date(
                        booking.show.showDateTime
                      ).toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: bold;">Seats:</td>
                      <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #4F46E5;">${booking.bookedSeats.join(
                        ", "
                      )}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: bold;">Total Amount Paid:</td>
                      <td style="padding: 12px 0; text-align: right;">₹${booking.amount.toFixed(
                        2
                      )}</td>
                  </tr>
                  <tr>
                      <td style="padding: 12px 0; font-weight: bold;">Booking ID:</td>
                      <td style="padding: 12px 0; text-align: right;">${
                        booking._id
                      }</td>
                  </tr>
              </table>
  
              <p style="margin-top: 30px;">Please show this confirmation at the theater. Enjoy the show!</p>
              <p style="margin-top: 20px;">Best regards,<br>The MovieTime Team</p>
          </div>
          <div style="background-color: #f7f7f7; color: #777; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin:0;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
       `,
      });
    } catch (error) {
      console.error("Failed to send confirmation email:", error.message);
    }
  }
);

//Inngest Function to send reminders
const sendShowReminders = inngest.createFunction(
  { id: "send-show-reminders" },
  { cron: "0 */8 * * *" }, //Every 8 hours
  async ({ step }) => {
    const now = new Date();
    const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const windowStart = new Date(in8Hours.getTime() - 10 * 60 * 1000);

    //prepare reminder tasks
    const reminderTasks = await step.run("prepare-reminder-tasks", async () => {
      const shows = await Show.find({
        showTime: { $gte: windowStart, $lte: in8Hours },
      }).populate("movie");

      const tasks = [];
      for (const show of shows) {
        if (!show.movie || !show.occupiedSeats) continue;

        const userIds = { ...new Set(Object.values(show.occupiedSeats)) };
        if (userIds.length === 0) continue;

        const users = await User.find({ _id: { $in: userIds } }).select(
          "name email"
        );

        for (const user of users) {
          tasks.push({
            userEmail: user.email,
            userName: user.name,
            movieTitle: show.movie.title,
            showTime: show.showTime,
          });
        }
      }

      return tasks;
    });

    if (reminderTasks.length === 0) {
      return { sent: 0, message: "No reminders to send" };
    }

    //Send reminder emails
    const results = await step.run("send-all-reminders", async () => {
      return await Promise.allSettled(
        reminderTasks.map((task) =>
          sendEmail({
            to: task.userEmail,
            subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,
            body: `
           <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #f97316; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Showtime Reminder!</h1>
    </div>
    <div style="padding: 25px;">
        <p style="font-size: 16px;">Hi ${task.userName},</p>
        <p>This is a friendly reminder that your movie, <strong>${
          task.movieTitle
        }</strong>, is starting soon!</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 16px; color: #555;">Your show starts at:</p>
            <p style="margin: 10px 0; font-size: 28px; font-weight: bold; color: #111;">
                ${new Date(task.showTime).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: "Asia/Kolkata",
                })}
            </p>
            <p style="margin: 0; font-size: 16px; color: #555;">
                on ${new Date(task.showTime).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
            </p>
        </div>

        <p style="margin-top: 30px;">Please make sure to arrive a little early to get your snacks and find your seats. We can't wait to see you!</p>
        <p style="margin-top: 20px;">Enjoy the movie,<br>The MovieTime Team</p>
    </div>
    <div style="background-color: #f7f7f7; color: #777; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin:0;">This is an automated reminder. Please do not reply to this email.</p>
    </div>
  </div>
          `,
          })
        )
      );
    });

    const sent = results.filter((r) => r.status === "fullfilled").length;
    const failed = results.length - sent;

    return {
      sent,
      failed,
      message: `Sent ${sent} reminder(s), ${failed} failed`,
    };
  } 
);

const sendNewShowNotifications = inngest.createFunction(
  { id: "send-new-show-notificaton" },
  { event: "app/show.added" },
  async ({ event }) => {
    const { movieTitle, movieId } = event.data;
    const users = await User.find({});

    for (const user of users) {
      const userEmail = user.email;
      const userName = user.name;
      const movieLink = `http://localhost:5173/movies/${movieId}`;

      const subject = `New Show Added: ${movieTitle}`;
      const body = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #10B981; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Just Announced!</h1>
          </div>
          <div style="padding: 25px;">
              <p style="font-size: 16px;">Hi ${userName},</p>
              <p>Great news! A new show has just been added for a movie we think you'll love.</p>
              
              <div style="background-color: #f3f4f6; padding: 25px; margin: 20px 0; border-left: 4px solid #10B981; text-align: center;">
                  <h2 style="margin: 0 0 10px 0; font-size: 22px;">${movieTitle}</h2>
                  <p style="margin:0; font-size: 16px; color: #555;">Now available for booking!</p>
              </div>

              <p style="text-align: center; margin-top: 30px;">Be among the first to get your tickets. Click the button below to see showtimes and book your seats now!</p>
              
              <div style="text-align: center; margin: 30px 0;">
                  <a href="${movieLink}" style="background-color: #10B981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Book Your Tickets</a>
              </div>

              <p style="margin-top: 30px;">Happy watching,<br>The MovieTime Team</p>
          </div>
          <div style="background-color: #f7f7f7; color: #777; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin:0;">You are receiving this email because you are a registered user.</p>
          </div>
        </div>
      `;
      await sendEmail({
        to: userEmail,
        subject,
        body,
      });
    }

    return {message: "Notification sent."}
  }
);

// Create an empty array where we'll export future Inngest functions
export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
  sendShowReminders,
  sendNewShowNotifications,
];
