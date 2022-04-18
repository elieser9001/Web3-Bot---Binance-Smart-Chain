import Web3 from 'web3'
import config from './config.js'
import dotenv from 'dotenv'
import https from 'https'
import blessed from 'blessed'
import moment from 'moment'
import sqlite3 from 'sqlite3'

import { EventEmitter } from "events"
dotenv.config()

class Panbot extends EventEmitter {
    constructor(order, dbPath) {
      super()

      this.dbPath = dbPath
      this.db = null

      this.inspectValue = null

      this.privateKey = process.env.privateKey
      this.abi = config.pancakeswap.abi
      this.routerContractAddress = config.pancakeswap.routerContractAddress
      this.walletAddress = process.env.walletAddress
      this.pancakeswap = null
      this.web3 = null
      this.connected = false
      this.bscScanAPIKey = process.env.bscScanAPIKey
      this.curPrice = null
      this.lastPrice = null
      this.priceDiff = null

      this.diffCount = 10 // 10 up and 10 down
      this.diffUp = []
      this.diffDown = []
      this.diffUpAverage = null
      this.diffDownAverage = null

      this.diffSumCount = 5 // 10 up and 10 down
      this.triggerSumAverage = 3.00
      this.diffSumUp = []
      this.diffSumDown = []
      this.diffSumUpAverage = null
      this.diffSumDownAverage = null
      this.trending = null
      this.trendingFormat = 'NA'
      this.lastTrendingTime = null
      this.lastTrendingTimestamp = null
      this.trendingType = {
        BULLISH: 'bullish',
        BEARISH: 'bearish'
      }

      this.diffType = {
        down: 'down',
        up: 'up'
      }

      this.lastHighPrice = 0
      this.lastLowPrice = 0

      this.lastMinOrMax = null
      this.lastMinOrMaxTimestamp = null

      this.orderOpenId = null

      this.amount = null
      this.usdtAmount = null
      this.bnbAmount = null
      this.tokenDecimals = null

      this.order = order

      this.mainScreen = null
      this.mainBox = null
      this.orderBox = null
      this.logBox = null

      this.eventsList = {
        statusChange: 'StatusChange'
      }

      this.statusList = {
        log: 'log',
        error: 'error',
        info: 'info',
        ready: 'ready',
        priceUpdate: 'priceUpdate',
        amountUpdate: 'amountUpdate',
        amountBnbUpdate: 'amountBnbUpdate',
        buy: 'buy',
        sell: 'sell',
        connected: 'connected',
        orderOpen: 'orderOpen',
        orderClose: 'orderClose'
      }

      this.states = {
        idle: 'idle',
        connecting: 'connecting',
        gettingPrice: 'gettingPrice'
      }
    }

    __emitEvent(eventName, eventType, eventParams) {
      eventParams = eventParams || []
  
      this.emit(eventName, eventType, eventParams)
    }
  
    __log(data) {
      this.__emitEvent(
        this.eventsList.statusChange,
        this.statusList.log,
        [data]
      )
    }
  
    _emitError(error) {
      this.__emitEvent(
        this.eventsList.statusChange,
        this.statusList.error,
        [error]
      )
    }
  
    _emitInfo(info) {
      this.__log(info)
      this.__emitEvent(
        this.eventsList.statusChange,
        this.statusList.info,
        [info]
      )
    }

    __sumArray(array) {
      const sum = array.reduce(function(previousValue, currentValue) { return previousValue + currentValue}, 0)

      return sum
    }

    addDiff(value, diffType) {
      if (diffType === this.diffType.down)  {
        if (this.diffDown.length === this.diffCount) {
          this.diffDown.shift()  
        }

        this.diffDown.push(parseFloat(value))
      } else if (diffType === this.diffType.up)  {
        if (this.diffUp.length === this.diffCount) {
          this.diffUp.shift()  
        }

        this.diffUp.push(parseFloat(value))
      }
    }

    addSumDiff(value, diffType) {
      if (diffType === this.diffType.down)  {
        if (this.diffSumDown.length === this.diffSumCount) {
          this.diffSumDown.shift()
        }

        this.diffSumDown.push(parseFloat(value))

      } else if (diffType === this.diffType.up)  {
        if (this.diffSumUp.length === this.diffSumCount) {
          this.diffSumUp.shift()  
        }

        this.diffSumUp.push(parseFloat(value))
      }
    }

    sumDifferences(diffType) {
      if (diffType === this.diffType.down)  {
        return this.__sumArray(this.diffDown)
      } else if (diffType === this.diffType.up)  {
        return this.__sumArray(this.diffUp)
      }
    }

    sumDifferencesAverages(diffType) {
      if (diffType === this.diffType.down)  {
        return this.__sumArray(this.diffSumDown)
      } else if (diffType === this.diffType.up)  {
        return this.__sumArray(this.diffSumUp)
      }
    }

    getTime() {
      return moment().format('LTS')
    }

    async connect() {
      this.web3 = new Web3(new Web3.providers.HttpProvider("https://bsc-dataseed1.binance.org"))

      await this.web3.eth.net.isListening()
      .then(() => this.connected = true)
      .catch(e => this.__log('web3 connection error: '+ e))

      if (this.connected === true) {
        this.pancakeswap = await new this.web3.eth.Contract(
          this.abi,
          this.routerContractAddress
        )
      }

      return this.web3
    }

    async updateAmount(walletAddress, tokenAddress, tokenName) {
      const tokenAbi = config.token.abi
      const tokenContract = await new this.web3.eth.Contract(tokenAbi, tokenAddress)
      let amount = await tokenContract.methods.balanceOf(walletAddress).call()
      const tokenDecimals = await tokenContract.methods.decimals().call()

      
      amount = amount.toString()
      amount = amount.slice(0, amount.length - tokenDecimals) + "." + amount.slice(amount.length - tokenDecimals)
      
      amount = parseFloat(amount).toFixed(2)

      this.__emitEvent(
				this.eventsList.statusChange,
				this.statusList.amountUpdate,
        [amount, tokenName]
			)
    }

    __percent(percentOf, value) {
      return parseFloat(parseFloat(percentOf / 100 * value).toFixed(2))
    }

    calculateExitAmount(gainLimitPercent, transactionFee, value) {
      return this.__percent(gainLimitPercent, value) + parseFloat(transactionFee)
    }

    __createMainScreen() {
      const self = this

      this.mainScreen = blessed.screen({
          smartCSR: true,
          cursor: {
              artificial: false
          }
      })

      this.mainScreen.tittle = ''

      this.mainBox = blessed.box({
          top: 'center',
          left: 'center',
          width: '100%',
          height: '100%',
          tags: true,
          style: {
              fg: 'white',
          }
      })
      
      this.mainScreen.append(this.mainBox)

      this.orderBox = blessed.box({
          parent: this.mainBox,
          tags: true,
          top: 2,
          width: '35%',
          height: '90%',
      })

      this.logBox = blessed.box({
          title: 'log',
          parent: this.mainBox,
          tags: true,
          scrollable: true,
          alwaysScroll: true,
          top: 2,
          left: this.orderBox.width + 1,
          width: '15%',
          height: '95%',
      })

      this.logBox2 = blessed.box({
          parent: this.mainBox,
          tags: true,
          scrollable: true,
          alwaysScroll: true,
          top: 2,
          left: this.logBox.left + this.logBox.width + 1,
          width: '10%',
          height: '95%',
      })

      this.logBox3 = blessed.box({
          parent: this.mainBox,
          tags: true,
          scrollable: true,
          alwaysScroll: true,
          top: 2,
          left: this.logBox2.left + this.logBox2.width + 1,
          width: '15%',
          height: '95%',
      })

      this.logBox4 = blessed.box({
        parent: this.mainBox,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        top: 2,
        left: this.logBox3.left + this.logBox3.width + 1,
        width: '10%',
        height: '95%',

    })
    
    this.logBox5 = blessed.box({
        parent: this.mainBox,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        top: 2,
        left: this.logBox4.left + this.logBox4.width + 1,
        width: '10%',
        height: '95%',
    })

      this.mainScreen.append(this.orderBox)
      this.mainScreen.append(this.logBox)
      this.mainScreen.append(this.logBox2)
      this.mainScreen.append(this.logBox3)
      this.mainScreen.append(this.logBox4)
      this.mainScreen.append(this.logBox5)
      
      this.mainScreen.key(['escape', 'q', 'C-c'], function(ch, key) {
        return process.exit(0)
      })
      
      this.orderBox.key(['u'], function() {
        self.updateAmount(self.order.walletAddress, self.order.tokenAddress, self.order.tokenName)
        // USDT
        self.updateAmount(self.order.walletAddress, "0x55d398326f99059fF775485246999027B3197955", 'usdt')
        // BNB
        self.updateBnbBalance()
      })

      this.orderBox.focus()
      this.mainScreen.render()
    }

    async connectDB() {
      this.db = await new sqlite3.Database(this.dbPath)
    }

    async __initTables() {
      // table: orders
      // fields: token_name, price_open, price_close, usdt_amount_open, 
      // usdt_amount_close, usdt_profit, token_amount_profit, 
      // min_diff_price_open, min_diff_price_close, diff_open, diff_close
      // tokens_amount, bnb_amount_open, bnb_amount_close, 
      // gain_limit_percent, order_close, date_open, date_close, timestamp
      await this.db.run(`CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,token_name TEXT, price_open REAL, price_close REAL, usdt_amount_open REAL, usdt_amount_close REAL, usdt_profit REAL, token_amount_profit REAL, min_diff_price_open NUMBER, min_diff_price_close NUMBER, diff_open REAL, diff_close REAL,tokens_amount REAL, bnb_amount_open REAL, bnb_amount_close REAL, gain_limit_percent NUMBER, order_close BOOLEAN, date_open DATETIME, date_close DATETIME, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`)
    }

    async openOrder(
      tokenName,
      priceOpen,
      usdtAmountOpen,
      bnbAmountOpen,
      gainLimitPercent,
      dateOpen,
      minDiffPriceOpen,
      minDiffPriceClose,
      diffOpen
    ) {
      const self = this

      this.db.run(
        `INSERT INTO orders(
          token_name, price_open, usdt_amount_open,
          bnb_amount_open, gain_limit_percent, date_open,
          min_diff_price_open, min_diff_price_close, diff_open,
          order_close
        ) VALUES(?),(?),(?),(?),(?),(?),(?),(?),(?),(?)`,
        [
          tokenName,
          priceOpen,
          usdtAmountOpen,
          bnbAmountOpen,
          gainLimitPercent,
          dateOpen,
          minDiffPriceOpen,
          minDiffPriceClose,
          diffOpen,
          false
        ], function(err) {
        if (err) {
          return console.log(err.message);
        } else {
          self.orderOpenId = this.lastID

          self.__emitEvent(
            self.eventsList.statusChange,
            self.statusList.orderOpen,
            [this.lastID]
          )
        }
      })
    }

    async closeOrder(
      orderId,
      priceClose,
      usdtAmountClose,
      bnbAmountClose,
      diffClose,
      usdtProfit,
      tokenAmountProfit
    ) {
      const self = this
      const dateClose = moment().unix()

      this.db.run(
        `UPDATE orders
            SET price_close = ?,
            usdt_amount_close = ?,
            bnb_amount_close = ?,
            diff_close = ?,
            usdt_profit = ?,
            token_amount_profit = ?,
            date_close = ?,
            order_close = ?,
            WHERE id = ?`,
        [
          priceClose,
          usdtAmountClose,
          bnbAmountClose,
          diffClose,
          usdtProfit,
          tokenAmountProfit,
          dateClose,
          true,
          orderId
        ], function(err) {
        if (err) {
          return console.log(err.message);
        } else {
          self.orderOpenId = this.lastID

          self.__emitEvent(
            self.eventsList.statusChange,
            self.statusList.orderClose,
            [orderId]
          )
        }
      })
    }

    async getOrder(orderId) {
      let sql = `SELECT * FROM orders WHERE id=?`
      
      const row = await this.db.get(sql, [orderId])

      return row
    }

    async getAllOrders() {
      let sql = `SELECT * FROM orders`
      
      const rows = await this.db.all(sql, [orderId])

      return rows
    }

    async start() {
      await this.connectDB()

      this.__createMainScreen()
      this.__log('connecting..')
      await this.connect()

      this.__emitEvent(
				this.eventsList.statusChange,
				this.statusList.connected
			)

      this.updateAmount(this.order.walletAddress, this.order.tokenAddress, this.order.tokenName)      
      this.updateAmount(this.order.walletAddress, "0x55d398326f99059fF775485246999027B3197955", 'usdt')
      
      this.updateBnbBalance()
      this.__log('connected!')
    }

    async updateBnbBalance() {
      let amount = await this.balance(this.order.walletAddress)
      
      amount = amount.toString()
      // amount = 
      amount = amount.slice(0, amount.length - 18) + "." + amount.slice(amount.length - 18)

      if (amount[0] === '.') {
        amount = '0' + amount
      }

      amount = parseFloat(amount).toFixed(4)

      this.__emitEvent(
				this.eventsList.statusChange,
				this.statusList.amountBnbUpdate,
        [amount]
			)
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async _calculateAmount(amountIn, tokenIn, tokenOut) {
      const abi = config.pancakeswap.abi
      const routerContractAddress = config.pancakeswap.routerContractAddress
      
      const pancakeswap = await new this.web3.eth.Contract(
        abi,
        routerContractAddress
      )
  
      const amounts = await pancakeswap.methods.getAmountsOut(
        amountIn,
        [tokenIn, tokenOut]
      ).call()
  
      const amountResult = this.web3.utils.fromWei(amounts[1])
  
      return amountResult
    }
  
    async updatePrice(tokenAddress) {
      this.lastPrice = this.curPrice
      const bnbAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
      const usdtAddress ="0x55d398326f99059fF775485246999027B3197955"
      const amountIn = this.web3.utils.toWei('1', 'ether')
  
      const bnbPrice = await this._calculateAmount(amountIn, bnbAddress, usdtAddress)
      const tokenAbi = config.token.abi
  
      const tokenContract = await new this.web3.eth.Contract(
        tokenAbi,
        tokenAddress
      )

      const tokenDecimals = await tokenContract.methods.decimals().call()
      const tokenAmount = '1' + '0'.repeat(tokenDecimals)
  
      const tokenAmountBnb = await this._calculateAmount(tokenAmount, tokenAddress, bnbAddress)
  
      this.curPrice = bnbPrice * tokenAmountBnb

      this.__emitEvent(
				this.eventsList.statusChange,
				this.statusList.priceUpdate,
        [this.curPrice]
			)
    }

    async getTokenSourceCode(tokenAddress, cb) {
      let data = ''

      const req = https.request({hostname: 'api.bscscan.com', path: '/api?module=contract&action=getsourcecode&address=' + tokenAddress + '&apikey=' + this.bscScanAPIKey, port: 443, method: 'GET'}, (res) => {      
        res.on(`data`, d => {
          data += d
        })

        res.on(`end`, ()=> {
          cb(data)
        })
      }).on(`error`, (err) => {
        this.__log("Error: " + err.message);
      });
    }

    async checkHoneypot(tokenAddress, cb) {
      this.getTokenSourceCode(tokenAddress, (data) => {
        // const tokenContractCode = JSON.parse(data)

        // cb(tokenContractCode.result[0].ABI)
        cb(data)
      })
    }

    async balance(address) {
      const balance = await this.web3.eth.getBalance(address)

      return balance;
    }

    async estimateGas(txn){
      let gas = await this.web3.eth.estimateGas({
        from: txn.from,
        to: txn.to,
        value: txn.value,
        data: txn.data
      })

      gas = gas + (gas / 10)

      return parseInt(gas)
    }

    async buy(){
      const txTimeoutMinutes = 20
      const slippage = 0.1 // percent y 0 para cuando sale venta de token

      
      const deadline = Math.floor(Date.now() / 1000) + 60 * txTimeoutMinutes
      const tokenIn = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' // wbnb
      const tokenOut = '0x196a03f90b9742f2dcbee3c3c0e6579def219728' // cryptotaxis
      const amountIn = this.web3.utils.toWei('0.0001', 'ether')
      const nonce = await this.web3.eth.getTransactionCount(this.walletAddress)

      const amounts = await this.pancakeswap.methods.getAmountsOut(amountIn, [
        tokenIn,
        tokenOut,
      ]).call()

      let amountOutMin = 0

      if (slippage > 0) {
        amountOutMin = parseInt(amounts[1] - (amounts[1] / 100 * slippage))
      }else{
        amountOutMin = 0
      }

      const gasPrice = this.web3.utils.toWei('5', 'gwei')
      const gasLimit = 290000

      const txPancakeswap = await this.pancakeswap.methods.swapExactETHForTokens(
          this.web3.utils.toHex(amountOutMin),
          [tokenIn, tokenOut],
          this.walletAddress,
          deadline
      )

      txPancakeswap.from = this.walletAddress
      txPancakeswap.to = this.routerContractAddress
      txPancakeswap.gasLimit = gasLimit
      txPancakeswap.gasPrice = gasPrice
      txPancakeswap.data = txPancakeswap.encodeABI()
      txPancakeswap.value = this.web3.utils.toHex(amountIn)
      txPancakeswap.nonce = nonce

      // ----------------------------------------
      const estimateGas = await this.estimateGas(txPancakeswap)

      txPancakeswap.gas = estimateGas

      const signedTx = await this.web3.eth.accounts.signTransaction(txPancakeswap, this.privateKey)

      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction)

        if (receipt.status === true){
          this.__log('Suscessfully Transaction!')
          this.__log('https://bscscan.com/tx/'+receipt.transactionHash)
        } else {
          this.__log('Transaction fail!')
          this.__log('https://bscscan.com/tx/'+receipt.transactionHash)
        }
    }
}

export default Panbot
