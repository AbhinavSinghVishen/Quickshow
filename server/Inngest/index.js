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

// Create an empty array where we'll export future Inngest functions
export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
];
