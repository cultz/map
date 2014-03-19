$.support.cors = true;
$.mobile.phone = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry)/);

var optionArray = ['승강기','촉지도','주차장','경사로','화장실'];

var qmap = {
	data: null,//marker list
	sess: null,//user session
	options: {
		db: 'maps', 
		skip: 0,
		limit: 30,
		sort: 'title',
		query: {lat:'lat:[0 TO 360]'},
		success: function(data) {
			this.data=data;
		},
		error: function(xhr, err) {
			alert('[Error] : Fail to data retrive');
		}
	},
	
	/**
	 * @param name: plugin name 
	 * @param prototype: plugin object 
	 * */
	plugin: function(name, prototype) {
		$[name] = $[name]||{};
		$[name] = function(opts, el) {
			if( arguments.length ) this.__init(opts, el);
		}
		$.extend($[name].prototype, this, prototype);
		$.fn[name] = function(opts) {
			var callable=typeof opts==="string", args=Array.prototype.slice.call(arguments, 1), rv=this;
			this.each(function() {
				var instance = $.data(this, name);
				if (!instance) instance = $.data(this, name, new $[name](opts, this));
				if (callable) rv = instance[opts].apply(instance, args);
			});
			return rv; 
		}
	},
	
	/**
	 * Get couchdb object
	 * @param name : database name 
	 */
	db: function(name) {
		return $.couch.db(name||this.options.db);
	},
	
	/**
	 * Get api path
	 * @param type : path type
	 */
	getPath: function(type) {
		switch(type) {
		case 'image': return $.couch.urlPrefix + '/_image/'+this.options.db;
		default :	return $.couch.urlPrefix + '/'+this.options.db;
		}
	},
	
	
	/**
	 * shift paging pointer
	 * @param p: pointer
	 */
	shift: function(p) {
		var skip = p + this.options.skip || 0;
		if( p > 0 && skip < this.options.total_rows || 0 ) {//next  
			return this.options.skip = skip;
		} else if(p < 0 && skip >= 0) {//prev
			return this.options.skip = skip;
		} 
		return -1;
	},
	
	/**
	 * Get next view data
	 * @param name : view name 
	 * @param opts : view options
	 */
	getNext: function(name, opts) {
		if( this.shift(this.options.limit) !== -1 ) {
			this.getView(name, opts);
		}
	},
	
	/**
	 * Get previous view data
	 * @param name : view name
	 * @param opts : view options
	 */
	getPrev: function(name, opts) {
		if( this.shift(-this.options.limit) !== -1 ) {
			this.getView(name, opts);
		}
	},
	
	/**
	 * Get document data
	 * @param docID :
	 * @param opts : get options  
	 */
	getDoc: function(docID, opts) {
		this.db().openDoc(docID, opts);
	},
	
	/**
	 * Save document
	 * @param doc : document object  
	 * @param opts : post options
	 */
	setDoc: function(doc, opts) {
		this.db().saveDoc(doc, opts);
	},
	
	/**
	 * Drop document
	 * @param doc : document object
	 * @param opts : post options
	 */
	dropDoc: function(doc, opts) {
		this.db().removeDoc(doc, opts);
	},
	
	/**
	 * Array getScore
	 * @param arr : array()
	 */
	getScore: function(arr) {
		var total = 0;
		for(i=0; i<arr.length; i++) {
			total += Number(arr[i]);
		}
		return total;
	},
	
	/**
	 * Object parseKeyword
	 * @param String kword : search word
	 */
	parseKeyword: function(kword) {
		var searchType = kword.charAt(0);
		searchWord = {};
		switch(searchType) {
			case '@'://username find
				if(kword.substr(1)) searchWord = {search:'username:"'+kword.substr(1)+'"'};
				break;
			case '#'://tags find
				if(kword.substr(1)) searchWord = {search:'tags:"'+kword.substr(1)+'"'};
				break;
			default://title find
				if(kword) searchWord = {search:'title:"'+kword+'"'};
		}
		return searchWord;
	},
	
	/**
	 * default map load
	 */
	viewMap: function() {
		var url =  localStorage.getItem('map.type')=='gmap' ? 'index.html' : 'index.htm';
		document.location = url;
	},
	
	/**
	 * 
	 */
	chkLogin: function(success, failure) {
		$.couch.session({success: success,error: failure});
	},
	/**
	 * void userLogin Form
	 * @param String url : return url
	 */
	userLogin: function(url) {
		url = url || document.location.href.split('/').pop();
		document.location='login.htm?url='+url;
	},

	/**
	 * void userLogout Process
	 */
	userLogout: function() {
		var self = this;
		try {
			$.couch.logout({
				success: function(resp) {alert("로그아웃 되었습니다.");self.viewMap();},
				error: function(status, error, reason) { alert("로그아웃 오류:" + status + error + reason); }
			});
		} catch(e) {
			alert(e);
		}
	},
	
	/**
	 * Get geo location 
	 */
	getGeoLocation: function(success, failure) {
		navigator.geolocation.getCurrentPosition(success, failure);
	},
	
	/**
	 * Get geo information from current location
	 */
	getGeoInformation: function(to, callback) {
		navigator.geolocation.getCurrentPosition(function(pos){
			var geo = {};
			var from = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude); //current location
			geo.distance = Math.round(google.maps.geometry.spherical.computeDistanceBetween(from, to)); //calculat distance
			geo.heading = Math.round(google.maps.geometry.spherical.computeHeading(from, to)); //calculat heading
			if(geo.distance > 1000) {
				geo.distance = geo.distance/1000 + 'Km';
			} else {
				geo.distance = geo.distance + 'm';
			}
			callback(geo);
		});
	},
	
	/**
	 * Converter position to address
	 */
	geoToAddress: function(latlng, callback) {
		var geocoder = new google.maps.Geocoder();
		geocoder.geocode({'latLng': latlng}, callback);
	},
	
	chkNetwork: function() {
		if(navigator.connection && navigator.connection.type == Connection.NONE) {
			navigator.notification.confirm("네트워크 오류\n\n프로그램을 종료하시겠습니까?", function(btnIndex){
				if(btnIndex==1)	navigator.app.exitApp();
			});	
		}
	},
	
	/**
	 * Get view data
	 * @param name:view name, opts:view options
	 */
	getView: function(name, opts) {
		var query = $.extend(this.options.query, opts.query), query_array=[]; //검색 온션
		for(k in query) query_array.push(query[k]);
		delete opts.query;
		
		var def_opts = { //기본 셋팅 값
			include_docs: true,
			sort: this.options.sort,
			skip: this.options.skip,
			limit: this.options.limit,
			error: this.options.error,
			success: this.options.success
		}
		
		$.extend(true, def_opts, opts, { 
			q : query_array.join(' AND '),
			cache : Math.floor(new Date().getTime()/1000)
		});
		
		this.db().find('marker'+name, def_opts);
	},
};


/**
 * Google map plugin 
 **/

(function($) {
	
	var self, maps, markers, cluster, bounds, infowindow, timer;
	
	qmap.plugin('gmap', {
		
		__init: function(opts, element) {
			self = this;
			$.extend( this.options, opts||{}, {success: self.success} );
			google.maps.visualRefresh = true;
			
			maps = new google.maps.Map(element, {
				zoom: 17,
				minZoom: 8,
				maxZoom: 19,
				panControl: false,
				mapTypeControl: false,
				mapTypeId: google.maps.MapTypeId.ROADMAP,
				center:new google.maps.LatLng(37.570,126.970)
			});
			
			if(this.options.db=='maps') {
				google.maps.event.addListener(maps, 'bounds_changed', function(){
					bounds = this.getBounds();
				});
				google.maps.event.addListenerOnce(maps, 'bounds_changed', function(){
					bounds = this.getBounds();
					$.mobile.loading("show");
					self.getView('/index', opts);
				});
				
			} else {
				google.maps.event.addListener(maps, 'bounds_changed', function(){
					clearTimeout(timer);
					timer = setTimeout(function(){
						var zo = this.getZoom();
						var ne = this.getBounds().getNorthEast();
						var sw = this.getBounds().getSouthWest();
						$.extend(opts, {query:{zoom:'zoom<int>:['+ zo +' TO 19]', lat:'lat<double>:['+sw.lat() + ' TO ' + ne.lat() + ']', lng:'lng<double>:['+sw.lng() + ' TO ' + ne.lng() + ']'}});
						
						$.mobile.loading("show");
						self.clearMarkers(); 
						self.getView('/index', opts);
					}, 100);
				});
			}
			
			navigator.geolocation.getCurrentPosition(function(pos){
				var currentPosition = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
				var m = new google.maps.Marker({map: maps, position: currentPosition, draggable: true});
				google.maps.event.addListener(m, 'dragend', function() { document.location = 'form.htm?lat='+m.getPosition().lat() + '&lng='+m.getPosition().lng(); });
				google.maps.event.addListener(m, 'click', function() { document.location = 'form.htm?lat='+m.getPosition().lat() + '&lng='+m.getPosition().lng();	});
				maps.panTo(currentPosition);
			});
		},

		success: function(data) {
			$.mobile.loading("hide");
			qmap.options.total_rows = data.total_rows;
			
			if(data.rows.length > 0 ) {
				markers = [];
				$.each(data.rows, function(k, v) {
					var doc = v.value || v.doc;
					var img = '';
					var score = qmap.getScore( doc.option||[] );
					var latlng = new google.maps.LatLng(doc.position[0], doc.position[1]);
					var icon = 'img/marker' + ((3-Math.ceil(score/2))||3) + '.png';
					for(file in doc.attachments) {
						img = '<img src="'+qmap.getPath('image')+'/'+doc._id+'/'+file+'?resize=90x90'+'" alt="'+file.alt+'" class="marker-thumb">'; break;
					}
					var marker = new google.maps.Marker({position: latlng, title: doc.title, icon: icon});
					google.maps.event.addListener(marker, 'click', function() {
						if (infowindow) {infowindow.close();}
						var markerInfo ='<h3 style="margin:5px 0"><a href="view.htm?id='+doc._id+'" rel="external" class="info-link">'+doc.title+'&nbsp;<span class="ui-icon ui-icon-arrow-r ui-icon-shadow" style="display:inline-block">&nbsp;</span></a></h3>';
						markerInfo += '<hr size="1"><div style="margin:-5px 0 3px 0;">'+doc.address.replace('대한민국 ','')+'</div>';
						markerInfo += '<div style="float:left">';
						var tagText='',optText='';
						if(doc.tags) {
							$((doc.tags).split(',')).each(function(){ tagText += '<span class="tag" title="태그:'+this+'">'+this+'</span>' });
							markerInfo += tagText;
						}
						if(doc.options) {
							$(doc.options).each(function(i) { if(this=='1') optText += '<img src="img/a-icon'+(i+1)+'.png" class="picto" alt="'+optionArray[i]+'">&nbsp;'; });
							markerInfo += '<div style="clear:both;padding:3px;">'+optText+'</div>';
						}
						markerInfo += '</div>';
						markerInfo += '<div style="float:right">'+img+'</div>';
						markerInfo = '<div style="min-width:220px;overflow:auto;">'+markerInfo+'</div>';
						infowindow = new google.maps.InfoWindow({content:markerInfo});
						infowindow.open(maps,marker);
					});
					markers.push(marker);
					bounds.extend(latlng);
				});
				//if(cluster) maps.fitBounds(bounds);
				cluster = new MarkerClusterer(maps, markers, {gridSize:30, maxZoom: 14});
			}
			
		},
		
		clearMarkers: function() {
			if(cluster) {  cluster.clearMarkers();	}
		},
		
		findPlace: function(kword, order) {
		 	this.clearMarkers();
		 	this.getView('/index', {query:this.parseKeyword(kword), sort: order||'title'});
		}
	});
	
}(jQuery));


/**
 * accessibility text map plugin
 */
(function($) {
	var el, self;
	qmap.plugin('able', {
		
		__init: function(opts, element) {
			el = element;
			self = this;
			console.log(opts);
			$.extend( this.options, opts||{}, {success:self.success} );//초기 옵션 설정
			$.mobile.loading("show");
			this.getView('/index', opts);
		},
		
		success: function(data) {
			$.mobile.loading("hide");
			self.options.total_rows = data.total_rows;
			if(data.rows.length > 0 ) {
				
				if(!$(el).html()) $(el).append('<ul class="ui-listview">');
				var ul = $(el).children('ul.ui-listview');

				$.each(data.rows, function(k, v) {
					var doc = v.value || v.doc;
					var score = qmap.getScore( doc.options||[] );
					
					var img = '<img src="img/blank.png" width=85 height=85 style="filter:alpha(opacity=10);opacity:0.1;-moz-opacity:0.1;filter:grapscale(100);-webkit-filter:grayscale(100%); ">';
					for(file in doc.attachments||{}) {
						img = '<img src="'+qmap.getPath('image')+'/'+doc._id+'/'+file+'?resize=95x95'+'" width="85" height="85" alt="'+(file.alt||'')+'">';break;
					}
					
					var tagText='',optText='';
					if(doc.tags) {
						$((doc.tags).split(',')).each(function(){ tagText += '<span class="tag" title="태그:'+this+'">'+this+'</span>' });
					}
					if(doc.options) {
						$(doc.options).each(function(i) { if(this=='1') optText += '<img src="img/a-icon'+(i+1)+'.png" class="picto">'; });
					}
					ul.append('<li><a href="view.htm?id='+doc._id+'" title="'+doc.title+'" rel="external">'+img+'<h3>'+(doc.title||'[위치명 없음]')+'</h3><p>'+doc.address.replace('대한민국 ','')+'<br/>'+optText+'</p><p class="ui-li-aside">'+tagText+'</p></a></li>');
				});
			}
			
			if((data.offset||data.skip) + self.options.limit >= data.total_rows) {
				$('#next-btn').remove();
			} else {
				if( $('#next-btn').length == 0 ) {
					$('#page-able').append('<a href="javascript:moreAble();" class="ui-btn" id="next-btn" title="더 보기">더보기..</a>');
				}
			}
			$('ul.ui-listview').listview().listview('refresh');
		},
		
		clearMarkers: function() {
			$('#next-btn').remove();
			$('.ui-content .ui-listview').remove();
		},
		
		findPlace: function(kword, order) {
			this.clearMarkers();
			this.getView('/index' , {skip:0, query:this.parseKeyword(kword), sort: order||'title'});
		},
		
		morePlace: function(kword, order) {
			if(kword) {
				this.getNext('/index', {query:this.parseKeyword(kword), sort: order||'title'});
			} else {
				this.getNext('/index', {limit:this.options.limit, sort: order||'title'} );//지도 초기화
			}
		}
	});
	
}(jQuery));


$.p=function(name){
	var param = decodeURI((RegExp(name + '=' + '(.+?)(&|$)').exec($.mobile.document[0].location.search)||[,null])[1]);
	return param=='null' ? null : param;
}

