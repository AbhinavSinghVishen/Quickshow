import mongoose from "mongoose";

const showSchema = new mongoose.Schema(
    {
        movie: {type: String, required: true, ref: 'Movie'},
        showDateTime: {type: Date, required: true},
        showPrice: {type: Number, required: true},
        occupiedSeats: {type: Object, default:{}},
    }, {minimize: false} 
    //If minimize is true -> If a field is an empty object ({}), Mongoose removes it before saving to the database. Means occupiedSeat will not be stored in MongoDB at all by default we are just providing to use it in js (like: show.occupiedSeats) so that is does not give unfined or some error
    //If minimize is false ->  It ensures that an empty occupiedSeats object always gets saved, not skipped.
)

const Show = mongoose.model("Show", showSchema)

export default Show