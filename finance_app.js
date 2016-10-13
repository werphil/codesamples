
/**
 * Wochennummer aus Datum berechnen
 * http://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
 */
function getWeekNumber(d) {
	// Copy date so don't modify original
	d = new Date(+d);
	d.setHours(0,0,0);
        var m = d.getDay() || 7;//!!Sonntag auf 7
	// Set to nearest Thursday: current date + 4 - current day number
	d.setDate(d.getDate() + 4 - m);  
	// Get first day of year
	var yearStart = new Date(d.getFullYear(),0,1);
	// Calculate full weeks to nearest Thursday
	var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7)
	// Return array of year and week number
	return {
		jahr: d.getFullYear(), 
		woche: weekNo };
}


fin

/**
 * SpecialDate Filter
 * q = Quartal, s = Semester, w &ww = Woche, t = Anz.Tage im Monat, wy = Jahr der ersten Woche
 */
.filter('dateX', function () {
	return function (datum, format) {
		
		if (datum == null || typeof datum === 'undefined') return false;
		
		switch(format) {
			
			case 'q':
			default:
				var mon = datum.getMonth()+1;
				
				if (mon >= 10) {
					return 4;
				} else if (mon >= 7) {
					return 3;
				} else if (mon >= 4) {
					return 2;
				} else {
					return 1;
				}
			break;
			
			case 's':
				var mon = datum.getMonth()+1;
				if (mon > 6) {
					return 2;
				} else {
					return 1;
				}
			break;
			
			case 'wy':
				return getWeekNumber(datum).jahr;
			break;
			
			case 'w':
			case 'ww':
				return getWeekNumber(datum).woche;
			break;
			
			case 't':
				var feb = (datum.getFullYear() % 4 == 0 && datum.getFullYear() % 1000 != 0)?29:28;
				var months = [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
				return months[datum.getMonth()];
			break;
		}		
	};
})


/****************************************
 * Datenmanipulationen f. E/A Rechnung
    - aktuelle Zeitspanne laden
    - Datumsoperationen
    - ..

 */

.service('eaData', function ($http, $modal, $filter, $locale, history, fixkosten) {
	var data = {
		result: 	null,   //vom Laden
		catlist: 	[],     //welche Kategorien geladen werden
		chart:		{       //Google Charts
			pie:	[],
			bar:	[],
			farben:	[]
		},
		saldo:		[0,0,0],//Anzeige linke Box
		kassabuch:	{
			ein:	[],
			aus:	[]
		}
	};
	var backup = null;      //f. Testdaten (Quicktour)
	var dialog = null;      //Modal Bugfix
        
	var	zeit = {
		typ: 'month',
		von: new Date(),
		bis: new Date(),
		anzW: []
	};
	
        //alias
	var that = this;
	var text = $locale.EADATA;
	
        //init Datumvars
	for (var i = 1; i <= 52; i++)	zeit.anzW.push(i);
	zeit.von.setHours(0,0,0,0);
	zeit.bis.setHours(0,0,0,0);
	
        /**
         * private
         */
        
        //Letzten Tag im Monat berechnen
	var getLastDay = function (date) {
		var vMon = date.getMonth() + 1;
		var nrDay = 30;
		
                switch (vMon) {
                    case 2:
                        nrDay = (date.getFullYear() % 4 === 0)?29:28; //Schaltjahr
                    break;
                    
                    case 1: case 3: case 5: case 7:
                    case 8: case 10: case 12:
                        nrDay = 31;
                    break;
                    
                    default:
                        break;
                }
		
		return nrDay;
	}
	
        //Anzahl Wochen im Jahr bestimmen
	var calcWochen = function () {
		var jahr = $filter("dateX")(zeit.von, "wy");
		var fd = new Date(jahr, 0, 1);
		var w;
		if ((jahr % 4 == 0 && fd.getDay() == 3) || fd.getDay() == 4) {
			zeit.anzW.splice(52,1);
			zeit.anzW.push(53);
		} else {
			zeit.anzW.splice(52,1);
		}
	}
	
        //von und bis aus wochennummer
	var week2date = function (value, year) {
		if (year === false) year = $filter("dateX")(zeit.von, "wy");
				
		j10 = new Date( year,0,10,12,0,0),
		j4 = new Date( year,0,4,12,0,0),
		mon1 = j4.getTime() - j10.getDay() * 86400000;
		
		zeit.von.setTime(mon1 + ((value - 1)  * 7) * 86400000);
		zeit.von.setHours(0,0,0);
		zeit.bis.setTime(zeit.von.getTime());
		zeit.bis.setDate(zeit.bis.getDate() + 6);
	}
	
        
        
        //init zeitraum (def: derz. Monat)
	zeit.von.setDate(1);
	zeit.bis.setDate(getLastDay(zeit.von));
	calcWochen();
        
        /**
         * public
         */
	
        //E/A neu Modal
	this.openDlg = function (type, quicktour) {
	    //if (dialog != null) dialog.close();
          
		dialog = $modal.open({
			templateUrl: 'html/dlg/eaDlg.html',
			controller: 'dlgControl',
			size: 'lg',
			resolve: {
				param: function () {
					return {
						eaType:	type,
						qtour:	quicktour
					};
				},
			}
		});
	}
	
	
	//HTTP
	///////////////////////////////////////////////////////////////////////////////////////////
        
        //Daten mit aktuellem Zeitraum laden
	this.getData = function (callback) {
		if (!data.result) {
			var v = $filter('date')(zeit.von, 'yyyy-MM-dd');
			var b = $filter('date')(zeit.bis, 'yyyy-MM-dd');
			
			$http.get('ajax/?do=eadata', { params: {'von': v, 'bis': b} }).then(
				function (response) {
					
					var obj = {
						result: 	null,
						catlist: 	[],
						chart:		{
							pie:	[],
							bar:	[],
							farben:	[]
						},
						saldo:		[0,0,0],
						kassabuch:	{
							ein:	[],
							aus:	[]
						}
					};
                                        
					
					//CATLISTE, CHART
					if (typeof response.data.result !== 'undefined' && response.data.result == true) {

					    obj.result = true;

					    //CATLIST
					    obj.catlist = response.data.main;

					    //SALDOBOX
					    if (typeof response.data.rechnung !== 'undefined' && response.data.rechnung.result == true) {
					        obj.saldo[0] = response.data.rechnung.einnahmen;
					        obj.saldo[1] = response.data.rechnung.ausgaben;
					        obj.saldo[2] = obj.saldo[0] - obj.saldo[1];
					    }

					    //KASSABUCH
					    if (typeof response.data.liste !== 'undefined' && response.data.liste.result == true) {
					        obj.kassabuch.aus = response.data.liste.aus;
					        obj.kassabuch.ein = response.data.liste.ein;
					    }
					}
					else
					{
					    obj.result = null;
					}

					angular.copy(obj, data);
					if (typeof callback === 'function') {
                                                console.log(data);
						callback(data);
					}
				},
				function (response) {
					if (typeof callback === 'function') callback({result: false})	});
		} else {
			if (typeof callback === 'function') callback(data);
		}
	}
        
        //Buchen (vom EA-Modal)
	this.buchen = function (info, callback) {

		$http.post('ajax/?do=buchen', info).then(
			function (response) {
				if (response.data.result == true) {
					
					//HISTORY
					if (info.update) {
						history.delete(true, info.edit);
					} else {
						history.delete(false, info.type);
					}
					var hData = info;
					hData.lastid = response.data.id;
					
					history.add(hData);
					
					//FIXKOSTEN
					if (info.fixkosten !== false) {
						var obj = {
							jahr: response.data.nYear,
							monat: response.data.nMonth,
							tag: response.data.nDay
						};
						fixkosten.buchen(info.fixkosten, obj);
					}	
					
					if (info.datum >= zeit.von && info.datum <= zeit.bis) {
						data.result = false;
						that.getData();
					}
					callback({result: true});	

				} else {
					callback({result: false, message: response.data.message});
				}
			}, function () {
				callback({result: false, message: null});
		});		
	}
	
        //BUCHUNG STORNIEREN
	this.storno = function (li, callback) {
		$http.post('ajax/?do=storno', {'id': li.id}).then(
			function (response) {
				if (response.data.result == true) {
					if (li.datum >= zeit.von && li.datum <= zeit.bis) {
						data.result = false;
						that.getData();
					}
					callback({result: true});
					history.delete(true, li);
				} else {
					callback({result: false, message: response.data.message});
				}
			},
			function (response) {
				callback({result: false, message: null});
		});
	}
	
	//TYPEN
	///////////////////////////////////////////////////////////////////////////////////////////
	this.getType = function () {
		return zeit.typ;
	}
	
	this.setType = function (type, callback) {
		zeit.typ = type;
			
		switch (type) {
			case 'day':
				zeit.bis.setFullYear(zeit.von.getFullYear());
				zeit.bis.setMonth(zeit.von.getMonth());
				zeit.bis.setDate(zeit.von.getDate());
			break;
			
			case 'month':
			default:
				zeit.bis.setFullYear(zeit.von.getFullYear());
				zeit.von.setDate(1);
				zeit.bis.setDate(2);
				zeit.bis.setMonth(zeit.von.getMonth());
				zeit.bis.setDate(getLastDay(zeit.von));	
			break;
			
			case 'week':
				zeit.bis.setFullYear(zeit.von.getFullYear());
				var wd = zeit.von.getDay();
				var diff = (wd == 0)?6:wd-1;
				zeit.von.setDate(zeit.von.getDate() - diff);
				zeit.bis.setTime(zeit.von.getTime());
				zeit.bis.setDate(zeit.von.getDate() + 6);
			break;
			
			case 'quarter':
				zeit.bis.setFullYear(zeit.von.getFullYear());
				var m = zeit.von.getMonth(),
				newm;
				if (m >=9) {
					newm = 9;
				} else if (m >= 6) {
					newm = 6;
				} else if ( m >=3 ) {
					newm = 3;
				} else {
					newm = 0;
				}
				zeit.von.setDate(1);
				zeit.von.setMonth(newm);
				zeit.bis.setDate(2);
				zeit.bis.setMonth(newm + 2);
				zeit.bis.setDate(getLastDay(zeit.bis));
			break;
			
			case 'semester':
				if (zeit.von.getMonth() >= 6) {
					zeit.von.setFullYear(zeit.von.getFullYear(), 6, 1);
					zeit.bis.setFullYear(zeit.von.getFullYear(), 11, 31);
				} else {
					zeit.von.setFullYear(zeit.von.getFullYear(), 0, 1);
					zeit.bis.setFullYear(zeit.von.getFullYear(), 5, 30);	
				}
			break;
			
			case 'year':
				zeit.von.setMonth(0);
				zeit.von.setDate(1);
				zeit.bis.setMonth(11);
				zeit.bis.setDate(31);
				zeit.bis.setFullYear(zeit.von.getFullYear());
			break;
			
			case 'range':
			
			break;
		}
		calcWochen();
		data.result = false;
		this.getData(function () { callback(); });
	}
	
	//ZEITRAUM
	///////////////////////////////////////////////////////////////////////////////////////////
	this.setPrev = function (datum, callback) {
		if (datum !== zeit.von) {
			zeit.von = datum;
			calcWochen();
			data.result = false;
			this.getData(function () { callback(); });
		}
	}
	this.setNext = function (datum, callback) {
		if (datum !== zeit.bis) {
			zeit.bis = datum;
			calcWochen();
			data.result = false;
			this.getData(function () { callback(); });
		}
	}
	
	
	//DATUM SELECT
	///////////////////////////////////////////////////////////////////////////////////////////
	this.getVon = function () {
		return zeit.von;
	}
	this.getBis = function () {
		return zeit.bis;
	}
	
	this.setDatum = function(type, value, callback) {
		
		var shouldReload = false;
		
		switch (type) {	
			case 'day':
				if (zeit.von.getDate() != value) shouldReload = true;
				
				var ld = getLastDay(zeit.von);
				if (value > ld) value = ld;
				zeit.von.setDate(value);
				zeit.bis.setDate(value);
			break;
			
			case 'month':
			default:
				if (zeit.von.getMonth() != value) shouldReload = true;
				zeit.von.setMonth(value);
				zeit.bis.setDate(2);
				zeit.bis.setMonth(value);
				zeit.bis.setDate(getLastDay(zeit.bis));
			break;
			
			case 'week':
				week2date(value, false);
			break;
			
			case 'quarter':
				var quarts = [
					{vm: 0,bm: 2, bd: 31},
					{vm: 3, bm: 5, bd: 30},
					{vm: 6, bm: 8, bd: 30},
					{vm: 9, bm: 11, bd: 31}
				];

				zeit.von.setDate(1);
				zeit.von.setMonth(quarts[value-1].vm);
				zeit.bis.setDate(quarts[value-1].bd);
				zeit.bis.setMonth(quarts[value-1].bm);
				
				shouldReload = true;
			break;
			
			case 'semester':
				var sem = [
					{vm: 0,bm: 5, bd: 30},
					{vm: 6, bm: 11, bd: 31} ];
				
				zeit.von.setDate(1);
				zeit.von.setMonth(sem[value-1].vm);
				zeit.bis.setDate(sem[value-1].bd);
				zeit.bis.setMonth(sem[value-1].bm);
				
				shouldReload = true;
			break;
			
			case 'year':
				if (zeit.von.getFullYear() != value) shouldReload = true;
				zeit.von.setFullYear(value);
				zeit.bis.setFullYear(value);
			break;
			
			case 'weekyear':
				var wno = getWeekNumber(zeit.von).woche;
				week2date(wno, value);
			break;
		}
		calcWochen();
		if (shouldReload) {
			data.result = false;
			this.getData(function () { callback(); });
		}
	}
	
	//PREV / NEXT PFEILE
	///////////////////////////////////////////////////////////////////////////////////////////
	this.prevnext = function (isNext, callback) {
		switch (zeit.typ) {
			case 'day':
				var i = (isNext)?1:-1;
				
				zeit.von.setDate(zeit.von.getDate() + i);
				zeit.bis.setFullYear(zeit.von.getFullYear(), zeit.von.getMonth(), zeit.von.getDate());
			break;
			
			case 'month':
			default:
				var i = (isNext)?1:-1;
				
				zeit.von.setMonth(zeit.von.getMonth() + i);
				zeit.bis.setFullYear(zeit.von.getFullYear(), zeit.von.getMonth(), getLastDay(zeit.von));	
			break;
			
			case 'week':
				var i = (isNext)?7:-7;
				
				zeit.von.setDate(zeit.von.getDate() + i);
				zeit.bis.setFullYear(zeit.von.getFullYear(), zeit.von.getMonth(), zeit.von.getDate() + 6);
			break;
			
			case 'quarter':
				var i = (isNext)?3:-3;
				
				zeit.von.setMonth(zeit.von.getMonth() + i);
				zeit.bis.setDate(2);
				zeit.bis.setMonth(zeit.von.getMonth() + 2);
				zeit.bis.setDate(getLastDay(zeit.bis));
				zeit.bis.setFullYear(zeit.von.getFullYear());
			break;
			
			case 'semester':
				var i = (isNext)?6:-6;
				
				zeit.von.setMonth(zeit.von.getMonth() + i);
				zeit.bis.setMonth(zeit.von.getMonth() + 5);
				zeit.bis.setDate(2);
				zeit.bis.setDate(getLastDay(zeit.bis));
				zeit.bis.setFullYear(zeit.von.getFullYear());
			break;
			
			case 'year':
				var i = (isNext)?1:-1;
				
				zeit.von.setFullYear(zeit.von.getFullYear() + i);
				zeit.bis.setFullYear(zeit.von.getFullYear());
			break;
			
			case 'range':
				var i = (isNext)?1:-1;
				
				zeit.von.setDate(zeit.von.getDate() + i);
				zeit.bis.setDate(zeit.bis.getDate() + i);
			break;
		}
		calcWochen();
		data.result = false;
		this.getData(function () { callback(); });
	}
	
	
	//LISTEN
	///////////////////////////////////////////////////////////////////////////////////////////
	this.getTypeList = function () {
		return [
		{text: text.MONAT, typ: 'month'},
		{text: text.TAG, typ: 'day'},
		{text: text.WOCHE, typ: 'week'},
		{text: text.QUARTAL, typ: 'quarter'},
		{text: text.SEMESTER, typ: 'semester'},
		{text: text.JAHR, typ: 'year'},
		{text: text.VONBIS, typ: 'range'}];	
	}
	
	this.getTage = function () {
		var arr = new Array(31);
		for (var i = 0; i < 31; i++)
			arr[i] = (i+1);
			
		return arr;
	}
	this.getWochen = function () {
		return zeit.anzW;
	}
	this.getJahre = function () {
		var arr = new Array(10);
		var dat = new Date().getFullYear();
		for (var i = 0; i < 10; i++)
			arr[i] = dat - i;
			
		return arr;	
	}
	
	//QUICKTOUR
        //mit Testdaten??
	///////////////////////////////////////////////////////////////////////////////////////////
	this.startQuicktour = function () {
		
		backup = JSON.parse(JSON.stringify(data));
		
		data.result = true;
		data.catlist = [
			{betrag: 60, budget: 100, color: "#900000", einnahme: false, icon: 'kleidung.png', id: 99999, titel: text.KLEIDUNG},
			{betrag: 120, budget: 150, color: "#009000", einnahme: false, icon: 'food.png', id: 99999, titel: text.LEBENSMITTEL},
			{betrag: 250, budget: 200, color: "#000090", einnahme: false, icon: 'betrieb.png', id: 99999, titel: text.BETRIEB}
		];
		data.chart.farben = ["#900000", "#009000", "#000090"];
		data.saldo = [800, 430, 370];
		generateKBQuicktour(false);
	}
	this.filterQuicktour = function (val) {
		generateKBQuicktour(val);
	}
	this.endQuicktour = function () {
		
		angular.copy(backup, data);
		backup = null;	
	}
	
	var generateKBQuicktour = function (filter) {
		var currDate = new Date();
		currDate.setHours(0,0,0);
		var betrag =	[25, 		40, 			150, 				60, 			5, 			2, 			15, 			100, 				28, 		5];
		var anm = text.ANMERKUNGEN;
		var kat = [text.KLEIDUNG, text.LEBENSMITTEL, text.BETRIEB, text.LEBENSMITTEL, text.KLEIDUNG, text.KLEIDUNG, text.LEBENSMITTEL, text.BETRIEB, text.KLEIDUNG, text.LEBENSMITTEL];
		var tage =		[5, 		10, 			11, 				13, 			18, 		19, 		21, 			23, 				24, 		25];
		data.kassabuch.aus.length = 0;
		for (var i=0; i<10; i++) {
		    if (filter && kat[i] != text.LEBENSMITTEL) continue;
			var dat = new Date(+currDate);
			dat.setDate(tage[i]);
			data.kassabuch.aus.push({betrag: betrag[i], anmerkung: anm[i], katname: kat[i], stamp: dat});
		}	
	}
	
	this.closeDlg = function () {
		if (dialog !== null) {
			dialog.close();
			dialog = null;
		}
	}
	
});