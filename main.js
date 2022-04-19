// import { relativeTimeThreshold } from 'moment';
import Panbot from './pancakebot.js'

async function botEvent(statusType, paramsArray) {
    const stats = this.statusList

    if (statusType === stats.connected) {
        // console.log('connected')
        this.updatePrice(this.order.tokenAddress)
    } else if (statusType === stats.priceUpdate) {
        const price = paramsArray[0]

        let maxOrMin = ''

        if (price > this.lastHighPrice) {
            this.lastHighPrice = price
            maxOrMin = '{green-fg} [Max] {/green-fg}'
            
            this.lastMinOrMax = '{green-fg} [Max] {/green-fg}'
            this.lastMinOrMaxTimestamp = Date.now()
        }

        if (price < this.lastLowPrice || this.lastLowPrice === 0) {
            this.lastLowPrice = price
            maxOrMin = '{red-fg} [Min] {/red-fg}'

            this.lastMinOrMax = '{red-fg} [Min] {/red-fg}'
            this.lastMinOrMaxTimestamp = Date.now()
        }

        let colorPrice = null
        let diffColor = ''

        const curPriceDiff = Math.abs(parseFloat((price - this.lastPrice) * 1000).toFixed(3))
        let samePrice = false
        this.priceDiff = curPriceDiff

        const curUsdtValue = this.amount * price
        let colorUsdtValue = null

        if (this.lastPrice < price && this.lastPrice !== null) {
            const lastDiffUp = parseFloat(this.diffUp[this.diffUp.length-1])
            if (lastDiffUp !== parseFloat(curPriceDiff)) {
                this.addDiff(curPriceDiff, this.diffType.up)
            }

            diffColor = '{green-fg}'+curPriceDiff+'{/green-fg}'
            colorPrice = '{green-fg}'+price+'{/green-fg}'
            colorUsdtValue = '{green-fg}'+curUsdtValue+'{/green-fg}'
        } else if (this.lastPrice > price  && this.lastPrice !== null) {
            const lastDiffDown = parseFloat(this.diffDown[this.diffDown.length-1])
            if (lastDiffDown !== parseFloat(curPriceDiff)) {
                this.addDiff(curPriceDiff, this.diffType.down)
            }

            diffColor = '{red-fg}'+curPriceDiff+'{/red-fg}'
            colorPrice = '{red-fg}'+price+'{/red-fg}'
            colorUsdtValue = '{red-fg}'+curUsdtValue+'{/red-fg}'
        } else if (this.lastPrice === price) {
            colorPrice = '{white-fg}'+price+'{/white-fg}'
            samePrice = true
        }

        this.mainBox.setLine(1,'{center}['+ this.order.tokenName +': {green-fg}' + price + '{/green-fg}]{/center}')
        let trendingSeconds = 0

        if (this.lastTrendingTimestamp === null) {
            trendingSeconds = 0
        } else {
            trendingSeconds = Math.round((Date.now() - this.lastTrendingTimestamp) / 1000)
        }

        if (parseFloat(this.diffSumUpAverage) >= this.triggerSumAverage) {
            
            if (this.trending !== this.trendingType.BULLISH) {
                this.lastTrendingTime = this.getTime()
                this.lastTrendingTimestamp = Date.now()
            }

            this.trendingFormat ='{green-fg}BULLISH - ' + this.lastTrendingTime + '{/green-fg}'
            this.trending = this.trendingType.BULLISH
        } else if (parseFloat(this.diffSumDownAverage) >= this.triggerSumAverage) {
            if (this.trending !== this.trendingType.BEARISH) {
                this.lastTrendingTime = this.getTime()
                this.lastTrendingTimestamp = Date.now()
            }

            this.trendingFormat = '{red-fg}BEARISH - ' + this.lastTrendingTime + '{/red-fg}'
            this.trending = this.trendingType.BEARISH
        }

        const LowAndHighDiff = parseFloat(this.lastHighPrice - this.lastLowPrice).toFixed(4)
        const rangeUsdtValue = '{yellow-fg}{bold}$' + parseFloat(LowAndHighDiff * this.amount).toFixed(2) + '{/bold}{/yellow-fg}'
        let diffUp = 0

        if (this.diffUp.length > 0) {
            diffUp = this.sumDifferences(this.diffType.up)
            diffUp = parseFloat(diffUp).toFixed(2)
        }

        let diffDown = 0
        
        if (this.diffDown.length > 0) {
            diffDown = this.sumDifferences(this.diffType.down)
            diffDown = parseFloat(diffDown).toFixed(2)
        }
        
        let diffIntersect = 0
        let diffSumDownAverages = 0
        let diffSumUpAverages = 0

        if (parseFloat(diffUp) > parseFloat(diffDown)) {
            diffIntersect = parseFloat(diffUp - diffDown).toFixed(2)

            if (parseFloat(this.diffSumUp[this.diffSumUp.length-1]) !== parseFloat(diffIntersect)) {
                this.addSumDiff(diffIntersect, this.diffType.up)
            }
            
            diffSumUpAverages = this.sumDifferencesAverages(this.diffType.up)

            this.diffSumUpAverage = parseFloat(diffSumUpAverages / this.diffSumUp.length).toFixed(2)

            diffSumDownAverages = this.sumDifferencesAverages(this.diffType.down)
            this.diffSumDownAverage = parseFloat(diffSumDownAverages / this.diffSumDown.length).toFixed(2)

            this.logBox5.insertBottom('{green-fg}'+diffIntersect+'{/green-fg}')
        } else {
            diffIntersect = parseFloat(diffDown - diffUp).toFixed(2)

            if (parseFloat(this.diffSumDown[this.diffSumDown.length-1]) !== parseFloat(diffIntersect)) {
                this.addSumDiff(diffIntersect, this.diffType.down)
            }
            
            diffSumDownAverages = this.sumDifferencesAverages(this.diffType.down)
            this.diffSumDownAverage = parseFloat(diffSumDownAverages / this.diffSumDown.length).toFixed(2)

            diffSumUpAverages = this.sumDifferencesAverages(this.diffType.up)
            this.diffSumUpAverage = parseFloat(diffSumUpAverages / this.diffSumUp.length).toFixed(2)

            this.logBox5.insertBottom('{red-fg}'+diffIntersect+'{/red-fg}')
        }

        this.logBox5.setScrollPerc(100)
        
        this.logBox4.insertBottom('{green-fg}'+diffUp+'{/green-fg}')
        this.logBox4.insertBottom('{red-fg}'+diffDown+'{/red-fg}')
        
        const percentDiffUp = Math.round((parseFloat(diffUp)/(parseFloat(diffUp)+parseFloat(diffDown)))*100)
        const percentDiffDown = Math.round((parseFloat(diffDown)/(parseFloat(diffUp)+parseFloat(diffDown)))*100)

        this.logBox4.setScrollPerc(100)
        
        if (!samePrice && this.lastPrice != null) {
            this.logBox.insertBottom(colorPrice)
            this.logBox.setScrollPerc(100)
            
            if (curPriceDiff > 0) {
                const curTime = this.getTime()

                this.logBox2.insertBottom(diffColor + ' ' + curTime.toString())
                this.logBox2.setScrollPerc(100)

                this.logBox3.insertBottom(colorUsdtValue)
                this.logBox3.setScrollPerc(100)
            }
        }

        const diffHigherPrice = parseInt(parseFloat(this.lastHighPrice - price).toFixed(4) * 1000)

        const diffLowerPrice = parseInt(parseFloat(price - this.lastLowPrice).toFixed(4) * 1000)

        const percentLower =  Math.round((parseFloat(diffHigherPrice)/(parseFloat(diffHigherPrice)+parseFloat(diffLowerPrice)))*100)
        
        const percentHigher =  Math.round((parseFloat(diffLowerPrice)/(parseFloat(diffHigherPrice)+parseFloat(diffLowerPrice)))*100)

        this.orderBox.content = 'Token name: ' + this.order.tokenName + '\n' +
            'Token address: {blue-fg}' + this.order.tokenAddress + '{/blue-fg}\n' +
            'Token Amount: ' + this.amount + '\n' +
            'USDT value: ' + this.amount * price + '\n' +
            // 'Stop loss: ' + this.order.stopLoss + '\n' +
            // 'Sell price: ' + this.order.sellPrice + '\n' +
            'USDT: ' + this.usdtAmount + '\n' +
            'Token value: ' + parseFloat(this.usdtAmount / price).toFixed(3) + '\n' +
            'BNB: ' + this.bnbAmount + '\n' +
            // 'Diff Up Avg: {green-fg}' + this.diffUpAverage + '{/green-fg}\n' +
            // 'Diff Down Avg: {red-fg}' + this.diffDownAverage + '{/red-fg}\n' +
            'Last Higher Price: {green-fg}' + this.lastHighPrice + ' -' + 
            
            diffHigherPrice
            
            + ' | ' + percentHigher + '%{/green-fg}\n' +
            'Token price: ' + colorPrice + ' ' + maxOrMin + '\n' +
            'Last Lower Price: {red-fg}' + this.lastLowPrice  + ' +' +  
            
            diffLowerPrice
            
            + ' | ' + percentLower + '%{/red-fg}\n' +
            'Last Edge: ' + this.lastMinOrMax +  + Math.round((Date.now() - this.lastMinOrMaxTimestamp) / 1000) + ' seconds from the last change\n' +
            'Low and High Diff: ' + LowAndHighDiff + '\n' +
            'Low and High Diff USDT: ' + rangeUsdtValue + '\n' +
            'Diff SUM Up Avg: {green-fg}' + this.diffSumUpAverage + '{/green-fg}\n' +
            'Diff SUM Down Avg: {red-fg}' + this.diffSumDownAverage + '{/red-fg}\n' +
            'Trending: ' + this.trendingFormat + '\n' +
            'Trending Seconds: ' + trendingSeconds + '\n' +
            'Percent Diff Up: {green-fg}'+ percentDiffUp + '%{/green-fg}\n'+
            'Percent Diff Down: {red-fg}'+ percentDiffDown + '%{/red-fg}\n'+
            // 'Inspect value: {yellow-fg}' + this.inspectValue + '{/yellow-fg}\n' +
            'Current Time: ' + this.getTime()
        
        this.mainScreen.render()

        // console.log(price)
        this.updatePrice(this.order.tokenAddress)
    } else if (statusType === stats.amountUpdate) {
        const amount = paramsArray[0]
        const tokenName = paramsArray[1]
        
        if (tokenName === 'usdt') {
            this.usdtAmount = amount
        } else if (tokenName === this.order.tokenName) {
            this.amount = amount
        }
    } else if (statusType === stats.amountBnbUpdate) {
        const amount = paramsArray[0]
        this.bnbAmount = amount
    } else if (statusType === stats.orderOpen) {
        const orderId = paramsArray[0]

    } else if (statusType === stats.orderClose) {
        const orderId = paramsArray[0]
        
    }
}

async function main() {
    // const token = {
    //     name = "ORKL",
    //     address = "0x36BC1F4D4Af21df024398150Ad39627FB2c8A847"
    // }

    // const token = {
    //     name: "NFS",
    //     address: "0x64815277c6caf24c1c2b55b11c78ef393237455c"
    // }
    
    // const token = {
    //     name: "CatCoin",
    //     address: "0x3b3691d4c3ec75660f203f41adc6296a494404d0"
    // }


    const token = {
        name: "CryptoMinesReborn",
        address: "0xe0191fefdd0d2b39b1a2e4e029ccda8a481b7995"
    }

    const order = {
        tokenName: token.name,
        tokenAddress: token.address,
        walletAddress: '0xAD3dE53D556d17aaF97f9aBd52016509B163da0B',
        tokenAmount: 0,
        USDT: 222,
        BNB: 111,
        gainLimitPercent: '2',
        transactionFee: 0.30,
        minDiffPriceOpen: 10,
        minDiffPriceClose: 10,
        stopLoss: 2.9999,
        sellPrice: '4.5000'
    }

    const pBot = new Panbot(order, './db/actions.db')

    pBot.on(pBot.eventsList.statusChange, botEvent)
    await pBot.start()
}

main()
