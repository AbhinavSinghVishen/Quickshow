import { inngest } from "../Inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js"
import stripe from 'stripe'


//Functoin to check availability of selected seats for a movie
const checkSeatAvailability = async(showId, selectedSeats) => {
    try {
        const showData = await Show.findById(showId)
        if(!showData)return false;

        const occupiedSeats = showData.occupiedSeats

        const isAnySeatTaken = selectedSeats.some(seat => occupiedSeats[seat])

        return !isAnySeatTaken
    } catch (error) {
        console.error(error.message)
        return false
    }
}

export const createBooking = async(req, res) => {
    try {
        const {userId} = req.auth()
        const {showId, selectedSeats} = req.body
        const {origin} = req.headers    //front end url

        //check if the seat is available for the selected show
        const isAvailable = await checkSeatAvailability(showId, selectedSeats)

        if(!isAvailable){
            return res.json({success: false, message: "Selected seats are not available"})
        }

        //Get the show details
        const showData = await Show.findById(showId).populate('movie')

        //create a new booking
        const booking = await Booking.create({
            user: userId,
            show: showId,
            amount: showData.showPrice * selectedSeats.length,
            bookedSeats: selectedSeats
        })

        selectedSeats.map((seat) => {
            showData.occupiedSeats[seat] = userId
        })

        showData.markModified('occupiedSeats')

        await showData.save()

        //Strings Gateway Initialize
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)

        //creating line items to for stripe
        const line_items = [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: showData.movie.title
                },
                unit_amount: Math.floor(booking.amount) * 100
            }, 
            quantity: 1
        }]

        //creating payment session
        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`,
            cancel_url: `${origin}/my-bookings`,
            line_items: line_items,
            mode: 'payment',
            metadata: {
                bookingId: booking._id.toString()
            },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60 //expires in 30 minutes
        })

        booking.paymentLink = session.url

        await booking.save()

        //Run Inngest schedular function to check payment status after 10 minutes
        await inngest.send({
            name: 'app/checkpayment',
            data:{
                bookingId: booking._id.toString()
            }
        })

        res.json({success: true, url: session.url})
    } catch (error) {
        console.error(error.message)
        res.json({success: false, message: error.message})
    }
}

export const getOccupiedSeats = async(req, res) => {
    try {
        const {showId} = req.params;
        const showData = await Show.findById(showId)

        const occupiedSeats = Object.keys(showData.occupiedSeats)

        res.json({success: true, occupiedSeats})
    } catch (error) {
        console.error(error.message)
        res.json({success: false, message: error.message})
    }
}