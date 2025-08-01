const Kconverter = (num) => {
    if(num >= 100000){
        return Math.floor(num / 1000) + 'K'
    }
    if(num >= 1000){
        const newNum = Math.floor((num / 1000) * 10) / 10
        return newNum.toString() + 'K'
    }
    return num
}

export default Kconverter